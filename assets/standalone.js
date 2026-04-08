(function () {
  const standaloneScript =
    document.currentScript ||
    Array.from(document.scripts).find((script) => (script.src || "").includes("standalone.js"));
  const standaloneAssetBase = standaloneScript?.src
    ? new URL(".", standaloneScript.src)
    : new URL("./assets/", window.location.href);
  const BRAND_STRIP_ALT =
    "Clients including Carbon, Deloitte, Gainwell CAT, Network18, Tennis Premier League, and StayNow";
  const QUALITY_FAQ_ANSWER =
    "Our process-driven approach, AI-driven tools, and industry expertise ensure high-quality, scalable, and efficient solutions tailored to client needs.";
  const CAREER_WIDGET_SCRIPT_SRC = "https://jobsapi.ceipal.com/APISource/widget.js";
  const CAREER_WIDGET_API_KEY = "aTdxK3Aza1Y4TTR5cVFvM3VzU0VOUT09";
  const CAREER_WIDGET_PORTAL_ID = "Z3RkUkt2OXZJVld2MjFpOVRSTXoxZz09";

  function getStandalonePage() {
    const normalizedPath = (window.location.pathname || "").replace(/\\/g, "/").toLowerCase();

    if (/\/about(?:\/index\.html)?\/?$/.test(normalizedPath)) {
      return "about";
    }

    if (/\/service(?:\/index\.html)?\/?$/.test(normalizedPath)) {
      return "service";
    }

    if (/\/career(?:\/index\.html)?\/?$/.test(normalizedPath)) {
      return "career";
    }

    if (/\/contact(?:\/index\.html)?\/?$/.test(normalizedPath)) {
      return "contact";
    }

    if (/^\/(?:index\.html)?$/.test(normalizedPath)) {
      return "home";
    }

    return "";
  }

  function getStandaloneAssetUrl(fileName) {
    return new URL(fileName, standaloneAssetBase).toString();
  }

  function markStandaloneSite() {
    document.body.classList.add("standalone-site");

    const standalonePage = getStandalonePage();

    if (standalonePage) {
      document.body.dataset.standalonePage = standalonePage;
    }
  }

  function setupStatCounters() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const counterCards = Array.from(document.querySelectorAll(".framer-1dq1u0o-container > div"))
      .map((valueWrap) => {
        const spans = Array.from(valueWrap.querySelectorAll("span"));
        const numberSpan = spans.find((span) => /\d/.test(span.textContent || ""));

        if (!numberSpan) return null;

        const end = Number.parseInt((numberSpan.textContent || "").replace(/[^\d]/g, ""), 10);

        if (!Number.isFinite(end) || end <= 0) return null;

        let start = 0;

        if (end <= 10) {
          start = Math.max(0, end - 4);
        } else if (end <= 25) {
          start = Math.max(0, end - 5);
        } else if (end < 100) {
          start = Math.max(0, Math.round(end * 0.76));
        } else if (end < 1000) {
          start = Math.max(0, Math.floor((end * 0.8) / 10) * 10);
        } else {
          start = Math.max(0, Math.floor((end * 0.82) / 100) * 100);
        }

        return {
          end,
          numberSpan,
          start: Math.min(start, end),
          valueWrap,
        };
      })
      .filter(Boolean);

    if (!counterCards.length) return;

    const animatedCounters = new WeakSet();

    const setCounterValue = (counter, value) => {
      counter.valueWrap.classList.add("standalone-counter");
      counter.numberSpan.classList.add("standalone-counter__number");
      counter.numberSpan.style.minWidth = `${String(counter.end).length}ch`;
      counter.numberSpan.textContent = String(value);
    };

    const animateCounter = (counter) => {
      if (!counter || animatedCounters.has(counter.valueWrap)) return;
      animatedCounters.add(counter.valueWrap);

      if (reduceMotion) {
        setCounterValue(counter, counter.end);
        return;
      }

      const duration = 1500;
      const startTime = performance.now();

      const tick = (now) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.round(
          counter.start + (counter.end - counter.start) * easedProgress
        );

        setCounterValue(counter, currentValue);

        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          setCounterValue(counter, counter.end);
        }
      };

      setCounterValue(counter, counter.start);
      requestAnimationFrame(tick);
    };

    counterCards.forEach((counter) => {
      if (reduceMotion) {
        setCounterValue(counter, counter.end);
        return;
      }

      setCounterValue(counter, counter.start);

      const revealTarget =
        counter.valueWrap.closest('[data-framer-name="Stats Item Block"]') ||
        counter.valueWrap.closest('[data-framer-name="Counter Item"]') ||
        counter.valueWrap.parentElement ||
        counter.valueWrap;

      if (!("IntersectionObserver" in window)) {
        requestAnimationFrame(() => animateCounter(counter));
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            animateCounter(counter);
            observer.unobserve(entry.target);
          });
        },
        {
          rootMargin: "0px 0px -12% 0px",
          threshold: 0.3,
        }
      );

      observer.observe(revealTarget);
    });
  }

  function revealAnimatedContent() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const motionTargets = [];
    const loadTargets = [];
    const observerTargets = [];
    const seen = new WeakSet();

    const registerMotion = (element, options = {}) => {
      if (!element || seen.has(element)) return;
      seen.add(element);

      element.dataset.motion = options.type || "fade-up";

      if (options.delay != null) {
        element.style.setProperty("--motion-delay", `${options.delay}ms`);
      }

      if (options.duration != null) {
        element.style.setProperty("--motion-duration", `${options.duration}ms`);
      }

      if (options.distance != null) {
        element.style.setProperty("--motion-distance", `${options.distance}px`);
      }

      if (options.load) {
        loadTargets.push(element);
      } else {
        observerTargets.push(element);
      }

      motionTargets.push(element);
    };

    document
      .querySelectorAll('[style*="opacity:0"]')
      .forEach((element) => {
        if (
          element.matches(".framer-192h4zo-container") ||
          element.closest(".framer-192h4zo-container")
        ) {
          return;
        }

        const style = element.getAttribute("style") || "";
        if (!/(will-change:transform|translateY\(|translateX\()/.test(style)) return;

        let type = "fade-up";
        if (style.includes("translateX(")) {
          type = "fade-side";
        } else if (style.includes("translateY(30px)")) {
          type = "fade-up-short";
        }

        registerMotion(element, { type });
      });

    const hero = document.querySelector('header[data-framer-name="Header"]');
    if (hero) {
      registerMotion(hero, {
        type: "hero-shell",
        delay: 40,
        duration: 900,
        distance: 36,
        load: true,
      });

      const heroImage = hero.querySelector('[data-framer-background-image-wrapper="true"]');
      if (heroImage) {
        registerMotion(heroImage, {
          type: "hero-image",
          delay: 120,
          duration: 1100,
          distance: 52,
          load: true,
        });
      }

      [
        { element: hero.querySelector(".framer-1qi09db"), delay: 120 },
        { element: hero.querySelector(".framer-j4un7u"), delay: 210 },
        { element: hero.querySelector(".framer-199cb0z"), delay: 290 },
      ].forEach(({ element, delay }) => {
        registerMotion(element, {
          type: "hero-up",
          delay,
          duration: 760,
          distance: 42,
          load: true,
        });
      });
    }

    const statsSection = document.querySelector('section[data-framer-name="Stats Section"]');
    if (statsSection) {
      registerMotion(statsSection.querySelector('[data-framer-name="Stats Heading Block"]'), {
        type: "fade-up",
        duration: 760,
      });

      Array.from(
        statsSection.querySelectorAll('[data-framer-name="Stats Item Block"] > div')
      ).forEach((element, index) => {
        registerMotion(element, {
          type: "metric-pop",
          delay: index * 90,
          duration: 680,
          distance: 32,
        });
      });
    }

    const serviceSection = document.querySelector('section[data-framer-name="Service Section"]');
    if (serviceSection) {
      Array.from(
        serviceSection.querySelectorAll(
          'a[data-framer-name="Shade"], a[data-framer-name="Shade Phone"]'
        )
      ).forEach((element, index) => {
        registerMotion(element.parentElement || element, {
          type: "fade-up",
          delay: (index % 3) * 90,
          duration: 720,
          distance: 44,
        });
      });
    }

    const brandStrip = document.querySelector(".standalone-brand-strip");
    if (brandStrip) {
      registerMotion(brandStrip, {
        type: "fade-up-short",
        duration: 820,
        distance: 28,
      });
    }

    Array.from(document.querySelectorAll('[data-framer-name="Features Large"] [data-framer-name="Features"]'))
      .forEach((element, index) => {
        registerMotion(element, {
          type: index % 2 === 0 ? "fade-right" : "fade-left",
          duration: 860,
          distance: 56,
        });
      });

    registerMotion(document.querySelector('[data-framer-name="Cta Content Wrapper"]'), {
      type: "fade-up-short",
      duration: 760,
      distance: 28,
    });

    registerMotion(document.querySelector('[data-framer-name="Footer Content Wrapper"]'), {
      type: "fade-up-short",
      duration: 760,
      distance: 28,
    });

    if (!motionTargets.length) return;

    document.body.classList.add("motion-enhanced");

    if (reduceMotion || !("IntersectionObserver" in window)) {
      motionTargets.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.14,
      }
    );

    observerTargets.forEach((element) => observer.observe(element));

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        loadTargets.forEach((element) => element.classList.add("is-visible"));
      });
    });
  }

  function injectIcon(container, markup) {
    if (!container || container.querySelector("[data-standalone-icon]")) return;
    container.innerHTML = markup;
  }

  function restoreIcons() {
    const linkedin =
      '<svg data-standalone-icon="linkedin" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6.94 8.5H3.56V20h3.38V8.5Zm.22-3.56C7.14 3.84 6.24 3 5.26 3S3.38 3.84 3.38 4.94c0 1.08.88 1.94 1.86 1.94h.02c1 0 1.9-.86 1.9-1.94ZM20.62 12.9c0-3.46-1.84-5.08-4.3-5.08-1.98 0-2.86 1.08-3.36 1.84V8.5H9.58c.04.76 0 11.5 0 11.5h3.38v-6.42c0-.34.02-.68.12-.92.28-.68.92-1.38 2-1.38 1.42 0 1.98 1.04 1.98 2.58V20h3.38v-7.1Z"/></svg>';
    const minus =
      '<svg data-standalone-icon="minus" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M6 12h12"/></svg>';

    document.querySelectorAll(".framer-d674xg-container").forEach((container) => {
      injectIcon(container, linkedin);
    });

    document.querySelectorAll(".framer-bsq30e-container").forEach((container) => {
      injectIcon(container, minus);
    });
  }

  function injectBrandStrip(container, modifierClass) {
    if (!container || container.querySelector(".standalone-brand-strip")) return;

    const stripImageUrl = getStandaloneAssetUrl("home-brand-strip.png");

    container.innerHTML = `
      <div class="standalone-brand-strip ${modifierClass}" role="img" aria-label="${BRAND_STRIP_ALT}">
        <div class="standalone-brand-strip__viewport">
          <div class="standalone-brand-strip__track">
            <span class="standalone-brand-strip__image" aria-hidden="true" style="background-image:url('${stripImageUrl}')"></span>
            <span class="standalone-brand-strip__image" aria-hidden="true" style="background-image:url('${stripImageUrl}')"></span>
          </div>
        </div>
      </div>
    `;
  }

  function restoreBrandTicker() {
    document.querySelectorAll(".framer-1b1l9rz .framer-1alb11-container").forEach((container) => {
      injectBrandStrip(container, "standalone-brand-strip--home");
    });

    document.querySelectorAll(".framer-l6kay5 .framer-10id718-container").forEach((container) => {
      injectBrandStrip(container, "standalone-brand-strip--service");
    });
  }

  function setupContactFormStatus() {
    const form = document.querySelector('form[action="/contact.php"]');

    if (!form) return;

    form.querySelectorAll('button[type="submit"] p, button[type="submit"] span').forEach((label) => {
      const normalizedLabel = (label.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();

      if (normalizedLabel === "send massage") {
        label.textContent = "Send Message";
      }
    });

    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");

    if (!status || form.querySelector("[data-standalone-form-status]")) return;

    const isSuccess = status === "success";
    const banner = document.createElement("p");
    const firstSubmitVariant = form.querySelector(".ssr-variant");

    banner.className = "standalone-form-status";
    banner.dataset.standaloneFormStatus = isSuccess ? "success" : "error";
    banner.setAttribute("role", isSuccess ? "status" : "alert");
    banner.textContent = isSuccess
      ? "Thanks. Your message was sent. We will get back to you soon."
      : "Your message could not be sent. Please try again or email info@appstechllc.com.";

    form.insertBefore(banner, firstSubmitVariant || null);

    if (window.history.replaceState) {
      const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }

  function setupContextualButtonHovers() {
    if (document.body.dataset.standalonePage !== "about") return;

    document
      .querySelectorAll(
        'a.framer-5uHYU, a.framer-IHV3O, a.framer-sMD7V, a.framer-a84psv[data-framer-name="Button"], a.framer-5vjhz5[data-framer-name="Button"], a.framer-1s01a0b[data-framer-name="Button"]'
      )
      .forEach((button) => {
        const label = (button.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();

        if (
          label === "view our protfolio" ||
          label === "view our portfolio" ||
          label === "portfolio"
        ) {
          const textNode =
            button.querySelector('[data-framer-name="Text"] p, [data-framer-name="Text"] span, p, span');

          if (textNode) {
            textNode.textContent = "View Our Portfolio";
          }

          button.dataset.standaloneDarkHover = "true";
        }
      });
  }

  function setupFaqAccordions() {
    const openIcon =
      '<svg data-standalone-icon="accordion-open" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.25" d="M7 14l5-5 5 5"/></svg>';
    const closedIcon =
      '<svg data-standalone-icon="accordion-closed" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.25" d="M7 10l5 5 5-5"/></svg>';

    document.querySelectorAll(".framer-uqW74").forEach((accordionGroup) => {
      const items = Array.from(
        accordionGroup.querySelectorAll(
          '.framer-aVSwJ[data-framer-name="Accordion Open"], .framer-aVSwJ[data-framer-name="Accordion Close"]'
        )
      );
      const closingTimers = new WeakMap();
      const openVariantClass = "framer-v-1smrpzj";
      const closedVariantClass = "framer-v-imoa92";
      const closeDuration = 360;

      if (!items.length) return;

      const clearCloseTimer = (item) => {
        const timer = closingTimers.get(item);

        if (timer) {
          window.clearTimeout(timer);
          closingTimers.delete(item);
        }
      };

      const finalizeClosedState = (item, answer, answerContent) => {
        item.classList.remove("is-open", "is-closing");
        item.classList.add("is-closed");
        item.classList.remove(openVariantClass);
        item.classList.add(closedVariantClass);
        item.setAttribute("aria-expanded", "false");
        item.setAttribute("data-framer-name", "Accordion Close");
        item.dataset.faqState = "closed";

        if (answer && answerContent) {
          answer.style.height = "1px";
          answer.style.maxHeight = "0px";
          answer.style.opacity = "0";
        }
      };

      const applyState = (item, open) => {
        const answer = item.querySelector('[data-framer-name="Accordian - Answer"]');
        const answerContent = answer?.firstElementChild;
        const icon = item.querySelector('[data-framer-name="Accordian - Icon"]');
        const question = item.querySelector('[data-framer-name="Accordian Question"]');
        const normalizedQuestion = (question?.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        let answerParagraph = answerContent?.querySelector("p");

        item.classList.toggle("standalone-accordion-item", true);
        item.classList.toggle("is-open", open);
        item.classList.toggle("is-closed", !open);
        item.classList.toggle(openVariantClass, open);
        item.classList.toggle(closedVariantClass, !open);
        item.setAttribute("aria-expanded", String(open));
        item.setAttribute("data-framer-name", open ? "Accordion Open" : "Accordion Close");
        item.dataset.faqState = open ? "open" : "closed";

        if (
          answerContent &&
          normalizedQuestion.includes("ensure quality in outsourcing services?")
        ) {
          if (!answerParagraph) {
            answerParagraph = document.createElement("p");
            answerParagraph.className = "framer-text framer-styles-preset-1rcjkrz";
            answerParagraph.setAttribute("data-styles-preset", "uD92Jh37M");
            answerContent.appendChild(answerParagraph);
          }

          answerParagraph.textContent = QUALITY_FAQ_ANSWER;
        }

        if (answer && answerContent) {
          answer.style.overflow = "hidden";
        }

        clearCloseTimer(item);

        if (open) {
          item.classList.add("is-open");
          item.classList.remove("is-closed", "is-closing");
          item.classList.add(openVariantClass);
          item.classList.remove(closedVariantClass);
          item.setAttribute("aria-expanded", "true");
          item.setAttribute("data-framer-name", "Accordion Open");
          item.dataset.faqState = "open";

          if (answer && answerContent) {
            answer.style.height = "auto";
            answer.style.maxHeight = `${answerContent.scrollHeight}px`;
            answer.style.opacity = "1";
          }
        } else {
          item.classList.remove("is-open", "is-closed");
          item.classList.add("is-closing");
          item.classList.add(openVariantClass);
          item.classList.remove(closedVariantClass);
          item.setAttribute("aria-expanded", "false");
          item.setAttribute("data-framer-name", "Accordion Close");
          item.dataset.faqState = "closed";

          if (answer && answerContent) {
            const currentHeight = answerContent.scrollHeight;
            answer.style.height = `${currentHeight}px`;
            answer.style.maxHeight = `${currentHeight}px`;
            answer.style.opacity = "1";
            void answer.offsetHeight;
            answer.style.maxHeight = "0px";
            answer.style.opacity = "0";
          }

          const timer = window.setTimeout(() => {
            finalizeClosedState(item, answer, answerContent);
            closingTimers.delete(item);
          }, closeDuration);

          closingTimers.set(item, timer);
        }

        if (icon) {
          icon.innerHTML = openIcon;
          if (!open) {
            icon.innerHTML = closedIcon;
          }
        }
      };

      const setActiveItem = (activeItem) => {
        items.forEach((item) => applyState(item, item === activeItem));
      };

      items.forEach((item) => {
        const isInitiallyOpen = item.getAttribute("data-framer-name") === "Accordion Open";

        item.tabIndex = 0;
        item.setAttribute("role", "button");
        applyState(item, isInitiallyOpen);

        const activate = () => {
          const shouldOpen = item.dataset.faqState !== "open";

          if (!shouldOpen) {
            applyState(item, false);
            return;
          }

          setActiveItem(item);
        };

        item.addEventListener("click", activate);
        item.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          activate();
        });
      });

      const syncOpenHeights = () => {
        items.forEach((item) => {
          if (item.dataset.faqState !== "open") return;

          const answer = item.querySelector('[data-framer-name="Accordian - Answer"]');
          const answerContent = answer?.firstElementChild;

          if (!answer || !answerContent) return;
          answer.style.maxHeight = `${answerContent.scrollHeight}px`;
        });
      };

      window.addEventListener("load", syncOpenHeights, { once: true });
      window.addEventListener("resize", syncOpenHeights);
    });
  }

  function setupStandaloneMenus() {
    document.querySelectorAll(".framer-1ydq4eo").forEach((row) => {
      const toggle = row.querySelector(".framer-j2omxc");
      const menu = row.querySelector('.framer-192h4zo-container[style*="opacity:0"]');
      if (!toggle || !menu) return;

      menu.dataset.standaloneMenu = "true";
      toggle.dataset.standaloneToggle = "true";
      toggle.tabIndex = 0;
      toggle.setAttribute("role", "button");
      toggle.setAttribute("aria-expanded", "false");

      const setOpen = (open) => {
        menu.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", String(open));
      };

      const toggleMenu = () => {
        if (window.matchMedia("(min-width: 768px)").matches) return;
        setOpen(!menu.classList.contains("is-open"));
      };

      toggle.addEventListener("click", toggleMenu);
      toggle.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggleMenu();
      });

      document.addEventListener("click", (event) => {
        if (menu.contains(event.target) || toggle.contains(event.target)) return;
        setOpen(false);
      });

      window.addEventListener("resize", () => {
        if (window.matchMedia("(min-width: 768px)").matches) {
          setOpen(false);
        }
      });
    });
  }

  function restoreCareerWidget() {
    if (document.body.dataset.standalonePage !== "career") return;

    const container = document.getElementById("example-widget-container");
    if (!container) return;

    const existingScript = document.querySelector('script[data-standalone-career-widget="true"]');
    if (existingScript) return;

    // Preserve the authored placeholder area so the CEIPAL widget can mount into it.
    container.style.minHeight = "960px";

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = CAREER_WIDGET_SCRIPT_SRC;
    script.async = true;
    script.dataset.standaloneCareerWidget = "true";
    script.setAttribute("data-ceipal-api-key", CAREER_WIDGET_API_KEY);
    script.setAttribute("data-ceipal-career-portal-id", CAREER_WIDGET_PORTAL_ID);
    document.body.appendChild(script);
  }

  function initializeStandalone() {
    markStandaloneSite();
    setupStatCounters();
    restoreIcons();
    restoreBrandTicker();
    setupContactFormStatus();
    restoreCareerWidget();
    setupContextualButtonHovers();
    setupFaqAccordions();
    setupStandaloneMenus();
    revealAnimatedContent();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeStandalone);
  } else {
    initializeStandalone();
  }
})();
