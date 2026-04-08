const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const EDGE_PATH =
  process.env.EDGE_PATH ||
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, timeoutMs, stepMs = 100) {
  const start = Date.now();
  for (;;) {
    try {
      const value = await fn();
      if (value) return value;
    } catch {}

    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out after ${timeoutMs}ms`);
    }

    await delay(stepMs);
  }
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

function quotePowerShell(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function launchEdge({ port, userDataDir }) {
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--mute-audio",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ];

  const argList = args.map(quotePowerShell).join(",");
  const command = [
    "$p = Start-Process",
    `-FilePath ${quotePowerShell(EDGE_PATH)}`,
    `-ArgumentList ${argList}`,
    "-PassThru;",
    "$p.Id",
  ].join(" ");

  const child = spawn("powershell.exe", ["-NoProfile", "-Command", command], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const pid = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `PowerShell launch failed with code ${code}`));
        return;
      }

      const parsedPid = Number.parseInt(stdout.trim(), 10);
      if (!parsedPid) {
        reject(new Error(stderr || "Failed to read launched Edge PID"));
        return;
      }

      resolve(parsedPid);
    });
  });

  return { pid };
}

class CDPClient {
  constructor(wsUrl) {
    this.socket = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });

    this.socket.addEventListener("message", async (event) => {
      const raw =
        typeof event.data === "string"
          ? event.data
          : event.data instanceof Blob
            ? await event.data.text()
            : Buffer.from(event.data).toString("utf8");
      const message = JSON.parse(raw);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
        return;
      }

      const listeners = this.events.get(message.method);
      if (!listeners) return;
      for (const listener of listeners) listener(message.params || {});
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(payload);
    });
  }

  on(method, listener) {
    if (!this.events.has(method)) {
      this.events.set(method, []);
    }
    this.events.get(method).push(listener);
  }

  close() {
    this.socket.close();
  }
}

async function createPage(port, url) {
  const target = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  }).then((response) => response.json());
  return target.webSocketDebuggerUrl;
}

async function run(configPath) {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const port = config.port || 9222;
  const userDataDir = path.resolve(config.userDataDir || ".cdp-profile");
  const verbose = Boolean(config.verbose);
  const keepAlive = setInterval(() => {}, 1000);

  fs.mkdirSync(userDataDir, { recursive: true });

  const edge = config.skipLaunch ? null : await launchEdge({ port, userDataDir });

  try {
    if (!config.skipVersionCheck) {
      await waitFor(async () => {
        const version = await getJson(`http://127.0.0.1:${port}/json/version`);
        return version.webSocketDebuggerUrl;
      }, 15000);
    }

    const wsUrl = await createPage(port, config.url || "about:blank");
    if (verbose) console.log(`Connected target: ${wsUrl}`);
    const client = new CDPClient(wsUrl);
    await client.connect();

    const loadStates = { fired: false };
    client.on("Page.loadEventFired", () => {
      loadStates.fired = true;
    });

    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("DOM.enable");
    await client.send("Network.enable");

    const width = config.viewport?.width || 1440;
    const height = config.viewport?.height || 2200;
    const deviceScaleFactor = config.viewport?.deviceScaleFactor || 1;
    const mobile = Boolean(config.viewport?.mobile);

    await client.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor,
      mobile,
    });

    if (config.viewport?.userAgent) {
      await client.send("Emulation.setUserAgentOverride", {
        userAgent: config.viewport.userAgent,
      });
    }

    await client.send("Page.navigate", { url: config.url || "about:blank" });

    await waitFor(() => loadStates.fired, 20000);
    await delay(config.afterLoadWaitMs || 1000);

    for (const step of config.steps || []) {
      if (verbose) console.log(`Step: ${step.type}`);

      if (step.type === "wait") {
        await delay(step.ms || 500);
        continue;
      }

      if (step.type === "eval") {
        const result = await client.send("Runtime.evaluate", {
          expression: step.expression,
          awaitPromise: true,
          returnByValue: true,
        });
        if (step.outFile) {
          fs.writeFileSync(step.outFile, JSON.stringify(result.result?.value ?? null, null, 2));
          if (verbose) console.log(`Wrote eval output: ${step.outFile}`);
        }
        continue;
      }

      if (step.type === "scroll") {
        await client.send("Runtime.evaluate", {
          expression: `window.scrollTo(${step.x || 0}, ${step.y || 0});`,
        });
        await delay(step.afterMs || 800);
        continue;
      }

      if (step.type === "screenshot") {
        const capture = await client.send("Page.captureScreenshot", {
          format: step.format || "png",
          captureBeyondViewport: Boolean(step.captureBeyondViewport),
        });
        fs.mkdirSync(path.dirname(step.path), { recursive: true });
        fs.writeFileSync(step.path, Buffer.from(capture.data, "base64"));
        if (verbose) console.log(`Wrote screenshot: ${step.path}`);
      }
    }

    client.close();
  } finally {
    clearInterval(keepAlive);
    if (edge) {
      try {
        process.kill(edge.pid);
      } catch {}
    }
  }
}

const configPath = process.argv[2];
if (!configPath) {
  console.error("Usage: node tools/edge-cdp.js <config.json>");
  process.exit(1);
}

run(path.resolve(configPath)).catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
