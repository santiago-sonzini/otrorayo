/* Contacto y duración de la apertura. No se necesita ningún servicio externo. */
const CONFIG = Object.freeze({
  instagram: "https://www.instagram.com/otrorayo/",
  whatsapp: "5493536563678",
  contactEndpoint: "/api/contact",
  introDuration: 7200,
});

(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobileMenu = window.matchMedia("(max-width: 1099px)");

  function listenToMedia(query, listener) {
    if (query.addEventListener) query.addEventListener("change", listener);
    else if (query.addListener) query.addListener(listener);
  }

  function setupMenu() {
    const toggle = document.querySelector("#menu-toggle");
    const nav = document.querySelector("#main-nav");
    if (!toggle || !nav) return;

    let open = false;
    function setOpen(next, returnFocus = false) {
      open = next && mobileMenu.matches;
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      toggle.classList.toggle("is-open", open);
      nav.classList.toggle("is-open", open);
      if (returnFocus) toggle.focus({ preventScroll: true });
    }

    toggle.addEventListener("click", () => {
      setOpen(!open);
      if (open) nav.querySelector("a, button")?.focus({ preventScroll: true });
    });
    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false, true);
      }
    });
    document.addEventListener("pointerdown", (event) => {
      if (open && !nav.contains(event.target) && !toggle.contains(event.target))
        setOpen(false);
    });
    document.addEventListener("focusin", (event) => {
      if (open && !nav.contains(event.target) && !toggle.contains(event.target))
        setOpen(false);
    });
    listenToMedia(mobileMenu, () => setOpen(false));
  }

  function setupExperiencePreview() {
    const visual = document.querySelector("#experience-visual");
    if (!visual) return;
    const names = {
      vr: "Visor de realidad virtual sobre un escenario de luz",
      visuals: "Escenario con tres pantallas de visuales",
      play: "Juego interactivo con una pantalla de objetivos",
    };
    visual.querySelectorAll("[data-experience]").forEach((button) => {
      button.addEventListener("click", () => {
        visual.dataset.mode = button.dataset.experience;
        visual
          .querySelector("svg")
          .setAttribute("aria-label", names[button.dataset.experience]);
        visual
          .querySelectorAll("[data-experience]")
          .forEach((item) =>
            item.setAttribute("aria-pressed", String(item === button)),
          );
      });
    });
  }

  function setupHeaderCTA() {
    const cta = document.querySelector(".header-cta");
    const heroCTA = document.querySelector(".hero-actions .button");
    const header = document.querySelector(".site-header");
    if (!cta || !heroCTA || !header) return;
    cta.classList.add("is-scroll-managed");
    let frame = 0;
    function update() {
      frame = 0;
      const show =
        heroCTA.getBoundingClientRect().top <
        header.getBoundingClientRect().bottom + 12;
      cta.classList.toggle("is-visible", show);
      cta.inert = !show;
      cta.setAttribute("aria-hidden", String(!show));
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    new ResizeObserver(schedule).observe(document.querySelector("#inicio"));
    update();
  }

  function setupReveals() {
    const elements = [...document.querySelectorAll("[data-reveal]")];
    const reveal = (element) => {
      element.classList.add("is-visible");
    };
    if (reducedMotion.matches || !("IntersectionObserver" in window)) {
      elements.forEach(reveal);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          reveal(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -24px 0px" },
    );

    elements.forEach((element) => {
      const bounds = element.getBoundingClientRect();
      if (bounds.top < window.innerHeight && bounds.bottom > 0) reveal(element);
      else {
        element.classList.add("reveal-pending");
        observer.observe(element);
      }
    });
    listenToMedia(reducedMotion, () => {
      if (!reducedMotion.matches) return;
      observer.disconnect();
      elements.forEach(reveal);
    });
  }

  function createScene(canvas, mode) {
    if (!canvas || !window.OtrorayoScene) return null;
    try {
      canvas.hidden = false;
      const renderer = window.OtrorayoScene.create(canvas, {
        mode,
        logoUrl: "assets/images/otrorayo-instagram.jpg",
        lowPower: Boolean(
          (navigator.hardwareConcurrency &&
            navigator.hardwareConcurrency <= 4) ||
          navigator.connection?.saveData,
        ),
      });
      if (!renderer) canvas.hidden = true;
      return renderer;
    } catch {
      canvas.hidden = true;
      // El signo real de respaldo permanece visible si Canvas no está disponible.
      return null;
    }
  }

  function setupParticles() {
    const canvas = document.querySelector("#ambient-particles");
    const fallback = { available: false, setPaused() {}, setIntroActive() {} };
    if (!canvas || !window.OtrorayoParticles) return fallback;
    try {
      if (window.OtrorayoJourney) {
        document.body.classList.add("journey-enabled");
        document.body.insertBefore(canvas, document.querySelector("main"));
      }
      const field = window.OtrorayoParticles.create(canvas);
      if (!field) return fallback;
      canvas.hidden = false;
      return { ...field, available: canvas.dataset.particlesReady === "true" };
    } catch {
      canvas.hidden = true;
      return fallback;
    }
  }

  function setupHeroScene(particles) {
    if (window.OtrorayoJourney) {
      const journey = window.OtrorayoJourney.create(particles);
      if (journey) return journey;
    }
    const canvas = document.querySelector("#hero-scene");
    const stage = document.querySelector(".hero-stage");
    const hero = document.querySelector("#inicio");
    const scene = createScene(canvas, "hero");
    if (!scene || !stage) {
      particles.setPaused(true);
      return {
        setIntroActive(active) {
          particles.setIntroActive(active);
        },
      };
    }

    let frame = 0;
    let inView = true;
    let introActive = false;
    let failed = false;
    let time = 0;
    let previous = 0;
    let lastPaint = 0;
    const target = { x: 0, y: 0 };
    const pointer = { x: 0, y: 0 };
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const lowPower =
      (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
      navigator.connection?.saveData;

    const shouldAnimate = () =>
      !failed &&
      inView &&
      !introActive &&
      !reducedMotion.matches &&
      !document.hidden &&
      !document.body.classList.contains("contact-is-open");
    function paint() {
      if (failed) return;
      try {
        const ready = scene.render(
          0.48 + 0.025 * Math.sin(time * 0.26),
          time,
          pointer,
        );
        if (ready === false) return;
        canvas.hidden = false;
        stage.classList.add("scene-ready");
      } catch {
        failed = true;
        canvas.hidden = true;
        stage.classList.remove("scene-ready");
        scene.destroy();
      }
    }
    function stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
    }
    function tick(now) {
      frame = 0;
      if (!shouldAnimate()) return;
      const interval = lowPower ? 1000 / 24 : 1000 / 30;
      if (now - lastPaint >= interval - 1) {
        time += previous ? Math.min((now - previous) / 1000, 0.08) : 0;
        previous = now;
        lastPaint = now;
        pointer.x += (target.x - pointer.x) * 0.075;
        pointer.y += (target.y - pointer.y) * 0.075;
        paint();
      }
      if (shouldAnimate()) frame = requestAnimationFrame(tick);
    }
    function synchronize() {
      if (shouldAnimate()) {
        if (!frame) frame = requestAnimationFrame(tick);
      } else stop();
    }
    canvas.addEventListener("otrorayo:ready", paint);
    hero.addEventListener(
      "pointermove",
      (event) => {
        if (!finePointer.matches || reducedMotion.matches) return;
        const bounds = hero.getBoundingClientRect();
        target.x = Math.max(
          -1,
          Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2),
        );
        target.y = Math.max(
          -1,
          Math.min(1, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2),
        );
      },
      { passive: true },
    );
    hero.addEventListener(
      "pointerleave",
      () => {
        target.x = 0;
        target.y = 0;
      },
      { passive: true },
    );
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        ([entry]) => {
          inView = entry.isIntersecting;
          synchronize();
        },
        { threshold: 0 },
      ).observe(hero);
    }
    window.addEventListener(
      "resize",
      () => {
        scene.resize();
        if (!document.hidden) paint();
      },
      { passive: true },
    );
    document.addEventListener("visibilitychange", synchronize);
    document.addEventListener("otrorayo:contact", synchronize);
    listenToMedia(reducedMotion, () => {
      target.x = target.y = pointer.x = pointer.y = 0;
      time = 0;
      paint();
      synchronize();
    });
    window.addEventListener("pagehide", stop);
    window.addEventListener("pageshow", synchronize);
    paint();
    synchronize();
    return {
      setIntroActive(active) {
        introActive = active;
        // The star field already travels behind the tunnel during the handoff.
        particles.setIntroActive(false);
        synchronize();
      },
      syncArrival(seconds) {
        time = seconds;
        pointer.x = pointer.y = 0;
        paint();
      },
    };
  }

  function setupIntro(heroScene) {
    const intro = document.querySelector("#intro");
    if (!intro) return;
    const canvas = document.querySelector("#intro-scene");
    const scene = createScene(canvas, "intro");
    const fullDuration = Math.min(
      7600,
      Math.max(6200, Number(CONFIG.introDuration) || 7200),
    );
    let running = false;
    let timers = [];
    let frame = 0;
    let restoreFocus = null;
    let pausedAt = null;
    let startedAt = 0;
    let duration = fullDuration;
    let quick = false;
    let fadeDuration = 250;
    let inertBefore = [];
    function lockPage() {
      document.documentElement.classList.add("intro-locked");
      inertBefore = [
        ...document.querySelectorAll("main, .site-header, .footer"),
      ].map((element) => [element, element.inert]);
      inertBefore.forEach(([element]) => {
        element.inert = true;
      });
    }
    function unlockPage() {
      document.documentElement.classList.remove("intro-locked");
      inertBefore.forEach(([element, wasInert]) => {
        element.inert = wasInert;
      });
      inertBefore = [];
    }
    const blockScroll = (event) => {
      if (running) event.preventDefault();
    };
    window.addEventListener("wheel", blockScroll, { passive: false });
    window.addEventListener("touchmove", blockScroll, { passive: false });

    const phrases = [...intro.querySelectorAll("[data-intro-phrase]")];
    let textPhase = -1;
    phrases.forEach((phrase, index) => {
      const words =
        index === 2
          ? [phrase.textContent.trim()]
          : phrase.textContent.trim().split(/\s+/);
      phrase.textContent = "";
      words.forEach((word, i) => {
        const clip = document.createElement("span"),
          ink = document.createElement("span");
        clip.className = "intro-word-clip";
        ink.className = "intro-word-ink";
        ink.textContent = word;
        ink.style.setProperty("--word-index", i);
        clip.append(ink);
        phrase.append(clip);
        if (index !== 2 && i < words.length - 1)
          phrase.append(document.createTextNode(" "));
      });
    });
    function updateText(progress) {
      const next =
        progress < 0.19 ? -1 : progress < 0.47 ? 0 : progress < 0.7 ? 1 : 2;
      if (next === textPhase) return;
      textPhase = next;
      phrases.forEach((phrase, index) => {
        phrase.classList.toggle("is-active", index === next);
        phrase.classList.toggle("is-past", index < next);
      });
    }
    function alignArrival() {
      const r = document.querySelector("#hero-scene")?.getBoundingClientRect();
      if (r && r.top >= -20 && r.top < innerHeight * 0.4) {
        scene?.setArrival?.({
          x: r.x + r.width / 2,
          y: r.y + r.height * 0.5,
          size: Math.min(r.width * 0.59, r.height * 0.66),
        });
      } else scene?.setArrival?.(null);
    }
    const blend = (from, to, value) => {
      const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
      return t * t * (3 - 2 * t);
    };
    function updateArrival(progress, seconds) {
      const style = document.body.style;
      style.setProperty("--intro-veil", 1 - blend(0.22, 0.46, progress));
      style.setProperty("--intro-logo", progress >= 0.86 ? 1 : 0);
      style.setProperty("--intro-ui", blend(0.84, 0.99, progress));
      style.setProperty("--intro-wordmark", blend(0.77, 0.92, progress));
      style.setProperty(
        "--intro-wordmark-y",
        `${32 * (1 - blend(0.77, 0.96, progress))}px`,
      );
      if (progress >= 0.84) heroScene.syncArrival?.(seconds);
    }
    const later = (callback, delay) =>
      timers.push(window.setTimeout(callback, delay));
    function stopRendering() {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    function hideIntro() {
      const introHadFocus = intro.contains(document.activeElement);
      running = false;
      unlockPage();
      pausedAt = null;
      timers.forEach(window.clearTimeout);
      timers = [];
      stopRendering();
      intro.hidden = true;
      phrases.forEach((phrase) =>
        phrase.classList.remove("is-active", "is-past"),
      );
      textPhase = -1;
      intro.classList.remove(
        "is-playing",
        "is-leaving",
        "is-quick",
        "is-reduced",
        "has-scene",
        "is-seamless",
      );
      document.body.classList.remove("intro-running", "intro-seamless");
      [
        "--intro-veil",
        "--intro-logo",
        "--intro-ui",
        "--intro-wordmark",
        "--intro-wordmark-y",
      ].forEach((key) => document.body.style.removeProperty(key));
      document.body.classList.add("intro-complete");
      heroScene.setIntroActive(false);
      if (introHadFocus) {
        const target = restoreFocus || document.querySelector("#main");
        if (target) {
          if (target.tagName === "MAIN" && !target.hasAttribute("tabindex"))
            target.tabIndex = -1;
          target.focus({ preventScroll: true });
        }
      }
      restoreFocus = null;
    }
    function leaveIntro() {
      if (!running || intro.classList.contains("is-leaving")) return;
      document.body.classList.remove("intro-seamless");
      intro.classList.add("is-leaving");
      later(hideIntro, fadeDuration);
    }
    function render(now) {
      frame = 0;
      if (!running || quick || !scene || document.hidden) return;
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / duration);
      try {
        updateText(progress);
        updateArrival(progress, elapsed / 1000);
        const ready = scene.render(progress, elapsed / 1000, { x: 0, y: 0 });
        canvas.hidden = false;
        intro.classList.toggle("has-scene", ready !== false);
      } catch {
        canvas.hidden = true;
        intro.classList.remove("has-scene");
        leaveIntro();
        return;
      }
      if (elapsed < duration) frame = requestAnimationFrame(render);
    }
    function startIntro() {
      if (running) hideIntro();
      quick = reducedMotion.matches || !scene;
      duration = quick ? 300 : fullDuration;
      fadeDuration = quick ? 150 : 250;
      running = true;
      lockPage();
      pausedAt = null;
      startedAt = performance.now();
      restoreFocus = null;
      // Instalar la salida antes de mostrar la capa. El contenido ya está pintado.
      later(hideIntro, 8100);
      later(hideIntro, duration);
      if (quick) later(leaveIntro, duration - fadeDuration);
      intro.style.setProperty("--intro-duration", `${duration}ms`);
      intro.style.setProperty("--intro-fade", `${fadeDuration}ms`);
      intro.classList.toggle("is-quick", quick);
      intro.classList.toggle("is-seamless", !quick);
      document.body.classList.toggle("intro-seamless", !quick);
      if (!quick) updateArrival(0, 0);
      intro.classList.toggle("is-reduced", reducedMotion.matches);
      intro.hidden = false;
      intro.classList.add("is-playing");
      document.body.classList.remove("intro-complete");
      document.body.classList.add("intro-running");
      heroScene.setIntroActive(true);
      if (canvas) canvas.hidden = true;
      if (!quick) {
        canvas.hidden = false;
        scene.resize();
        alignArrival();
        render(startedAt);
      }
    }
    document.addEventListener("keydown", (event) => {
      if (
        running &&
        [
          "ArrowDown",
          "ArrowUp",
          "ArrowLeft",
          "ArrowRight",
          "PageDown",
          "PageUp",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      )
        event.preventDefault();
      if (running && event.key === "Escape") {
        event.preventDefault();
        leaveIntro();
      }
    });
    window.addEventListener(
      "resize",
      () => {
        if (running && !quick) {
          scene?.resize();
          alignArrival();
        }
      },
      { passive: true },
    );
    document.addEventListener("visibilitychange", () => {
      document.body.classList.toggle("page-hidden", document.hidden);
      if (document.hidden) {
        stopRendering();
        if (running && !quick && !intro.classList.contains("is-leaving")) {
          pausedAt = performance.now();
          timers.forEach(window.clearTimeout);
          timers = [];
        }
      } else if (running && pausedAt !== null) {
        const now = performance.now();
        startedAt += now - pausedAt;
        pausedAt = null;
        const elapsed = now - startedAt;
        const remaining = Math.max(0, duration - elapsed);
        later(hideIntro, remaining);
        later(hideIntro, remaining + 900);
        frame = requestAnimationFrame(render);
      } else if (running && !quick && !frame) {
        frame = requestAnimationFrame(render);
      }
    });
    listenToMedia(reducedMotion, () => {
      if (!reducedMotion.matches || !running) return;
      quick = true;
      stopRendering();
      if (canvas) canvas.hidden = true;
      intro.classList.remove("has-scene");
      intro.classList.add("is-quick", "is-reduced");
      fadeDuration = 150;
      intro.style.setProperty("--intro-fade", "150ms");
      leaveIntro();
    });
    // Every page load gets the complete opening; background tabs wait until visible.
    if (document.hidden) {
      const startWhenVisible = () => {
        if (document.hidden) return;
        document.removeEventListener("visibilitychange", startWhenVisible);
        startIntro();
      };
      document.addEventListener("visibilitychange", startWhenVisible);
    } else startIntro();
  }

  function initialize() {
    const typeface = new URLSearchParams(location.search).get("typeface");
    if (["space-grotesk", "sora", "manrope", "syne"].includes(typeface))
      document.body.dataset.typeface = typeface;
    window.OtrorayoPageStart?.reset();
    setupExperiencePreview();
    setupMenu();
    setupHeaderCTA();
    window.OtrorayoContact?.init(CONFIG);
    setupReveals();
    const year = document.querySelector("#year");
    if (year) year.textContent = String(new Date().getFullYear());
    document.body.classList.add("js-ready");
    const particles = setupParticles();
    let eventScene = null;
    try {
      eventScene = window.OtrorayoJourney
        ? null
        : window.OtrorayoEvent?.create(document.querySelector("#event-scene"));
    } catch {
      /* La escena es decorativa; el contenido y el portal siguen disponibles. */
    }
    const effects = {
      available: particles.available || Boolean(eventScene),
      setPaused(value) {
        particles.setPaused(value);
        eventScene?.setPaused(value);
      },
      setIntroActive(value) {
        particles.setIntroActive(value);
        eventScene?.setIntroActive(value);
      },
    };
    const heroScene = setupHeroScene(effects);
    setupIntro(heroScene);
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
