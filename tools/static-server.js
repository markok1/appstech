const http = require("http");
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const host = process.argv[3] || "127.0.0.1";
const port = Number(process.argv[4] || "8080");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function resolveTarget(urlPath) {
  const pathname = decodeURIComponent((urlPath || "/").split("?")[0]);
  const relative = pathname.replace(/^\/+/, "");
  let target = path.join(root, relative);

  if (pathname === "/" || pathname === "") {
    target = path.join(root, "index.html");
  } else if (pathname.endsWith("/")) {
    target = path.join(root, relative, "index.html");
  } else if (!path.extname(target)) {
    const dirIndex = path.join(root, relative, "index.html");
    const htmlFile = `${target}.html`;

    if (fs.existsSync(dirIndex)) {
      target = dirIndex;
    } else if (fs.existsSync(htmlFile)) {
      target = htmlFile;
    }
  }

  return target;
}

function send(res, statusCode, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const target = resolveTarget(req.url);

  if (!target.startsWith(root)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(target, (error, data) => {
    if (error) {
      send(res, 404, "Not found");
      return;
    }

    const ext = path.extname(target).toLowerCase();
    send(res, 200, data, mimeTypes[ext] || "application/octet-stream");
  });
});

server.listen(port, host, () => {
  process.stdout.write(`STATIC_SERVER_READY ${host}:${port}\n`);
});
