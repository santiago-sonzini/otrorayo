/* Noche estrellada en profundidad. Sólo ocupa el hero; no tapa el contenido. */
(() => {
  "use strict";
  const noise = (n) => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  function create(canvas) {
    let ctx;
    try {
      ctx = canvas?.getContext("2d");
    } catch {
      return null;
    }
    if (!ctx) return null;
    const media = matchMedia("(prefers-reduced-motion: reduce)"),
      owner = canvas.parentElement;
    let width = 1,
      height = 1,
      dpr = 1,
      stars = [],
      frame = 0,
      last = 0,
      time = 0,
      paused = false,
      intro = false,
      inView = true,
      destroyed = false,
      pageAway = false;
    const pointer = { x: 0, y: 0 },
      target = { x: 0, y: 0 };
    const cleanups = [];
    function on(target, type, fn, options) {
      target.addEventListener(type, fn, options);
      cleanups.push(() => target.removeEventListener(type, fn, options));
    }
    function glow(color) {
      const c = document.createElement("canvas");
      c.width = c.height = 48;
      const g = c.getContext("2d");
      const gradient = g.createRadialGradient(24, 24, 0, 24, 24, 24);
      gradient.addColorStop(0, "#fff");
      gradient.addColorStop(0.08, "#edf5ff");
      gradient.addColorStop(0.22, color + "bb");
      gradient.addColorStop(0.6, color + "15");
      gradient.addColorStop(1, color + "00");
      g.fillStyle = gradient;
      g.fillRect(0, 0, 48, 48);
      return c;
    }
    const sprites = [glow("#a5c4e3"), glow("#ecdcc5")];
    function galaxy(seed) {
      const c = document.createElement("canvas");
      c.width = c.height = 640;
      const g = c.getContext("2d");
      g.translate(320, 320);
      g.rotate(-0.42);
      for (let i = 0; i < 1500; i++) {
        const r = Math.pow(noise(i + seed), 0.72) * 285;
        const arm = ((i % 3) * Math.PI * 2) / 3;
        const angle =
          arm + r * 0.024 + (noise(i + 57) - 0.5) * (1.2 + r * 0.002);
        const x = Math.cos(angle) * r,
          y = Math.sin(angle) * r * 0.43;
        const s = 0.5 + noise(i + 92) * 1.4;
        g.globalAlpha = (0.12 + noise(i + 7) * 0.42) * (1 - r / 320);
        g.fillStyle = i % 5 === 0 ? "#ccad89" : "#7797b9";
        g.beginPath();
        g.arc(x, y, s, 0, Math.PI * 2);
        g.fill();
      }
      const core = g.createRadialGradient(0, 0, 0, 0, 0, 92);
      core.addColorStop(0, "#e7dfca65");
      core.addColorStop(0.18, "#b5c4df25");
      core.addColorStop(1, "#6d93bb00");
      g.globalAlpha = 1;
      g.scale(1, 0.42);
      g.fillStyle = core;
      g.fillRect(-100, -100, 200, 200);
      return c;
    }
    const galaxies = [galaxy(13), galaxy(79), galaxy(151)];
    const liquidVeil = document.createElement("canvas");
    liquidVeil.width = liquidVeil.height = 1024;
    const liquidContext = liquidVeil.getContext("2d");
    const liquidSource = window.OtrorayoScene?.getLiquidSurface?.();
    if (liquidSource) {
      liquidContext.drawImage(liquidSource, 0, 0, 1024, 1024);
      liquidContext.globalCompositeOperation = "destination-in";
      const feather = liquidContext.createRadialGradient(
        512,
        512,
        110,
        512,
        512,
        500,
      );
      feather.addColorStop(0, "#fff");
      feather.addColorStop(0.5, "#ffffffbb");
      feather.addColorStop(1, "#ffffff00");
      liquidContext.fillStyle = feather;
      liquidContext.fillRect(0, 0, 1024, 1024);
    }
    const nebula = document.createElement("canvas");
    nebula.width = 960;
    nebula.height = 560;
    const nebulaContext = nebula.getContext("2d");
    for (let i = 0; i < 18; i++) {
      const x = 110 + noise(i + 600) * 750,
        y = 140 + Math.sin(i * 0.65) * 70 + i * 11;
      const cloud = nebulaContext.createRadialGradient(
        x,
        y,
        0,
        x,
        y,
        85 + noise(i) * 60,
      );
      cloud.addColorStop(0, i % 3 ? "#45678112" : "#80666c0d");
      cloud.addColorStop(1, "#17243800");
      nebulaContext.fillStyle = cloud;
      nebulaContext.fillRect(0, 0, 960, 560);
    }
    function resize() {
      const b = canvas.getBoundingClientRect();
      width = Math.max(1, b.width);
      height = Math.max(1, b.height);
      dpr = Math.min(devicePixelRatio || 1, innerWidth < 768 ? 1.5 : 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const count = innerWidth < 768 ? 220 : 520;
      stars = Array.from({ length: count }, (_, i) => ({
        x: (noise(i + 2) * 2 - 1) * 1.9,
        y: (noise(i + 502) * 2 - 1) * 1.55,
        z: 0.4 + noise(i + 82) * 3.6,
        size: noise(i + 92),
        index: i,
      }));
      canvas.dataset.particlesCount = String(count);
      paint();
    }
    function paint() {
      if (destroyed) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, width, height);
      const m = Math.min(width, height),
        drift = media.matches ? 0 : time * 0.024;
      if (liquidSource) {
        for (let side = 0; side < 2; side++) {
          ctx.save();
          ctx.translate(
            width * (side ? 0.89 : 0.13) + Math.sin(drift * 2 + side) * 30,
            height * (side ? 0.56 : 0.39) + Math.cos(drift + side) * 20,
          );
          ctx.rotate((side ? -0.55 : 0.35) + Math.sin(drift * 1.4) * 0.07);
          ctx.globalAlpha = side ? 0.15 : 0.19;
          const scale =
            Math.max(width * 0.76, height * 0.9) *
            (1 + Math.sin(drift * 1.7 + side) * 0.04);
          ctx.drawImage(
            liquidVeil,
            -scale / 2,
            -scale * 0.4,
            scale,
            scale * 0.8,
          );
          ctx.restore();
        }
      }
      ctx.globalAlpha = 0.52;
      ctx.drawImage(
        nebula,
        -width * 0.15 + Math.sin(drift) * 18,
        height * 0.03,
        width * 1.3,
        height * 0.9,
      );
      const positions = [
        {
          x: width * 0.8,
          y: height * 0.28,
          size: Math.min(width * 0.54, 660),
          angle: 0.12,
          alpha: 0.34,
        },
        {
          x: width * 0.17,
          y: height * 0.62,
          size: Math.min(width * 0.39, 400),
          angle: -0.7,
          alpha: 0.19,
        },
        {
          x: width * 0.63,
          y: height * 0.13,
          size: Math.min(width * 0.2, 220),
          angle: 0.6,
          alpha: 0.18,
        },
      ];
      for (let i = 0; i < (innerWidth < 768 ? 2 : 3); i++) {
        const g = positions[i];
        ctx.save();
        ctx.translate(
          g.x - pointer.x * 8 + Math.sin(drift + i) * 11,
          g.y - pointer.y * 5 + Math.cos(drift + i) * 6,
        );
        ctx.rotate(g.angle + drift * 0.1);
        ctx.globalAlpha = g.alpha;
        ctx.drawImage(galaxies[i], -g.size / 2, -g.size / 2, g.size, g.size);
        ctx.restore();
      }
      ctx.globalCompositeOperation = "screen";
      for (const star of stars) {
        const z = 0.4 + ((((star.z - 0.4 - time * 0.095) % 3.6) + 3.6) % 3.6);
        const perspective = 0.7 / z;
        const x =
          width * 0.5 +
          star.x * m * perspective -
          pointer.x * (1 + perspective * 5);
        const y =
          height * 0.47 +
          star.y * m * perspective -
          pointer.y * (1 + perspective * 5);
        if (x < 0 || x > width || y < 0 || y > height) continue;
        const fade = Math.min(1, (z - 0.4) * 2, (4 - z) * 2);
        const radius = (0.65 + star.size * 1.7) * (1 + perspective * 0.55);
        ctx.globalAlpha = fade * (0.24 + star.size * 0.43);
        ctx.drawImage(
          sprites[star.index % 9 === 0 ? 1 : 0],
          x - radius,
          y - radius,
          radius * 2,
          radius * 2,
        );
        if (star.size > 0.95) {
          ctx.globalAlpha = fade * 0.16;
          ctx.fillStyle = "#deebfa";
          ctx.fillRect(x - 0.3, y - radius * 1.3, 0.6, radius * 2.6);
        }
      }
      const comet = time % 19;
      if (!media.matches && comet > 10 && comet < 11.4) {
        const t = (comet - 10) / 1.4;
        const x = width * (0.17 + t * 0.24),
          y = height * (0.14 + t * 0.14);
        ctx.globalAlpha = Math.sin(t * Math.PI) * 0.18;
        const trail = ctx.createLinearGradient(x - 48, y - 22, x, y);
        trail.addColorStop(0, "#bfdfff00");
        trail.addColorStop(1, "#edf7ff");
        ctx.strokeStyle = trail;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(x - 48, y - 22);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
    const allowed = () =>
      !paused &&
      !intro &&
      !media.matches &&
      !document.hidden &&
      !pageAway &&
      inView &&
      !destroyed &&
      !document.body.classList.contains("contact-is-open");
    function tick(now) {
      frame = 0;
      if (!allowed()) return;
      if (now - last >= 32) {
        time += last ? Math.min((now - last) / 1000, 0.07) : 0;
        last = now;
        pointer.x += (target.x - pointer.x) * 0.06;
        pointer.y += (target.y - pointer.y) * 0.06;
        paint();
      }
      frame = requestAnimationFrame(tick);
    }
    function sync() {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      canvas.dataset.particlesActive = String(allowed());
      if (allowed()) frame = requestAnimationFrame(tick);
      else if (!intro && !document.hidden) paint();
    }
    on(
      owner,
      "pointermove",
      (event) => {
        if (event.pointerType === "touch" || media.matches) return;
        const b = owner.getBoundingClientRect();
        target.x = ((event.clientX - b.left) / b.width) * 2 - 1;
        target.y = ((event.clientY - b.top) / b.height) * 2 - 1;
      },
      { passive: true },
    );
    on(
      owner,
      "pointerleave",
      () => {
        target.x = target.y = 0;
      },
      { passive: true },
    );
    on(window, "resize", resize, { passive: true });
    on(document, "visibilitychange", sync);
    on(document, "otrorayo:contact", sync);
    on(window, "pagehide", () => {
      pageAway = true;
      sync();
    });
    on(window, "pageshow", () => {
      pageAway = false;
      sync();
    });
    on(media, "change", () => {
      pointer.x = pointer.y = target.x = target.y = 0;
      paint();
      sync();
    });
    let observer;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        sync();
      });
      observer.observe(owner);
    }
    canvas.hidden = false;
    resize();
    canvas.dataset.particlesReady = "true";
    sync();
    return {
      setPaused(value) {
        paused = Boolean(value);
        sync();
      },
      setIntroActive(value) {
        intro = Boolean(value);
        sync();
      },
      destroy() {
        destroyed = true;
        sync();
        cleanups.forEach((fn) => fn());
        observer?.disconnect();
        canvas.width = canvas.height = 1;
      },
    };
  }
  window.OtrorayoParticles = { create };
})();
