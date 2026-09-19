/* Comparador independiente: no modifica la landing ni guarda una elección. */
(() => {
  "use strict";
  const colors = ["#ee3825", "#ff6b0b", "#fec306", "#77bd20", "#188ad9"];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (a, b, p) => {
    const n = clamp((p - a) / (b - a));
    return n * n * (3 - 2 * n);
  };
  const noise = (n) => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return v - Math.floor(v);
  };
  const names = {
    prisma: "Prisma",
    orbita: "Órbita",
    pulso: "Pulso",
    interferencia: "Interferencia",
  };
  const notes = {
    prisma: "Óptico · limpio",
    orbita: "Espacial · preciso",
    pulso: "Atmosférico · intenso",
    interferencia: "Digital · directo",
  };
  const keys = Object.keys(names);
  const modules = (window.OtrorayoDirections = window.OtrorayoDirections || {});
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const dialog = document.querySelector("#direction-view");
  const motionButton = document.querySelector("#motion-toggle");
  const skip = document.querySelector("#skip-proposal");
  let kit = null;
  let frame = 0;
  let paused = false;
  let active = null;
  let introStart = 0;
  let introTimer = 0;
  let previousFocus = null;
  let lastFrame = 0;
  let animatedTime = 7;
  let failed = false;

  function makeCanvas(size = 384) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    return c;
  }
  function prepare(image) {
    const white = makeCanvas();
    const context = white.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 128, 128, 384, 384, 0, 0, 384, 384);
    const points = [];
    let tainted = false;
    try {
      const pixels = context.getImageData(0, 0, 384, 384);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const light =
          pixels.data[i] * 0.2126 +
          pixels.data[i + 1] * 0.7152 +
          pixels.data[i + 2] * 0.0722;
        pixels.data[i + 3] = light < 8 ? 0 : light;
        pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255;
      }
      context.putImageData(pixels, 0, 0);
      for (let y = 2; y < 382; y += 2)
        for (let x = 2; x < 382; x += 2) {
          if (pixels.data[(y * 384 + x) * 4 + 3] > 160)
            points.push({
              x: (x - 192) / 169,
              y: (y - 192) / 169,
              seed: noise(x * 0.3 + y * 1.81),
            });
        }
      points.sort((a, b) => a.seed - b.seed);
    } catch {
      tainted = true;
    }
    const tints = colors.map((color) => {
      const canvas = makeCanvas();
      const c = canvas.getContext("2d");
      c.drawImage(white, 0, 0);
      c.globalCompositeOperation = tainted ? "multiply" : "source-in";
      c.fillStyle = color;
      c.fillRect(0, 0, 384, 384);
      return canvas;
    });
    const sparks = colors.map((color) => {
      const canvas = makeCanvas(64),
        c = canvas.getContext("2d");
      const gradient = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, "#ffffff");
      gradient.addColorStop(0.065, "#ffffff");
      gradient.addColorStop(0.17, color + "f2");
      gradient.addColorStop(0.36, color + "65");
      gradient.addColorStop(0.72, color + "15");
      gradient.addColorStop(1, color + "00");
      c.fillStyle = gradient;
      c.fillRect(0, 0, 64, 64);
      return canvas;
    });
    const toolkit = {
      colors,
      white,
      mask: white,
      tints,
      points: points.slice(0, 2400),
      ease,
      clamp,
      logo(
        ctx,
        {
          x,
          y,
          size,
          color = -1,
          alpha = 1,
          rotation = 0,
          scaleX = 1,
          scaleY = 1,
          shear = 0,
        },
      ) {
        ctx.save();
        ctx.globalAlpha = clamp(alpha);
        ctx.globalCompositeOperation = "screen";
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.transform(scaleX, 0, shear, scaleY, 0, 0);
        ctx.drawImage(
          color >= 0 ? tints[color % 5] : white,
          -size / 2,
          -size / 2,
          size,
          size,
        );
        ctx.restore();
      },
      spark(ctx, x, y, radius, color = 0, alpha = 1) {
        if (radius <= 0 || alpha <= 0) return;
        const index =
          typeof color === "number"
            ? color
            : Math.max(0, colors.indexOf(color));
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = clamp(alpha);
        ctx.drawImage(
          sparks[index % 5],
          x - radius,
          y - radius,
          radius * 2,
          radius * 2,
        );
        ctx.restore();
      },
    };
    return toolkit;
  }

  // Una señal nítida con una única ruptura breve, sin raster permanente.
  modules.interferencia = {
    draw(ctx, w, h, t, pointer, k, phase) {
      const m = Math.min(w, h),
        intro = phase !== null;
      const p = intro ? phase : 0;
      const pulse = intro
        ? ease(0.22, 0.36, p) * (1 - ease(0.58, 0.77, p))
        : Math.pow(Math.max(0, Math.sin(t * 1.22)), 14);
      const settle = intro ? ease(0.7, 0.9, p) : 0;
      const reveal = intro ? ease(0.015, 0.2, p) : 1;
      const size = m * 0.61,
        x = w * 0.5 + (pointer.x || 0) * 7,
        y = h * 0.5 + (pointer.y || 0) * 5;
      const split =
        (m * 0.15 * pulse + (intro ? (1 - ease(0.05, 0.27, p)) * m * 0.4 : 0)) *
        (1 - settle);
      if (intro && p >= 0.91) {
        k.logo(ctx, { x, y, size });
        return;
      }
      for (let i = 4; i >= 0; i--) {
        k.logo(ctx, {
          x: x + (i - 2) * split * 0.45,
          y: y + Math.sin(i * 2.1) * split * 0.12,
          size,
          color: i,
          alpha: (0.15 + pulse * 0.55) * reveal * (1 - settle),
        });
      }
      const slices = 13;
      for (let i = 0; i < slices; i++) {
        const sy = (384 / slices) * i,
          sh = 384 / slices;
        const offset = (noise(Math.floor(i / 2) + 2) * 2 - 1) * split;
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = reveal * (0.9 + pulse * 0.1);
        ctx.drawImage(
          k.white,
          0,
          sy,
          384,
          sh,
          x - size / 2 + offset,
          y - size / 2 + (i * size) / slices,
          size,
          size / slices + 0.25,
        );
        ctx.restore();
      }
      if (pulse > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        for (let i = 0; i < 9; i++) {
          const yy = y - size * 0.43 + noise(i + 12) * size * 0.86;
          ctx.fillStyle = k.colors[i % 5];
          ctx.globalAlpha = pulse * 0.68;
          ctx.fillRect(
            x - size * 0.75 + noise(i + 5) * size * 1.35,
            yy,
            m * (0.013 + noise(i) * 0.11),
            0.7,
          );
        }
        ctx.restore();
      }
      if (settle) k.logo(ctx, { x, y, size, alpha: settle });
    },
  };

  function surface(canvas) {
    let ctx;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      return null;
    }
    if (!ctx) return null;
    const item = {
      canvas,
      ctx,
      w: 1,
      h: 1,
      dpr: 1,
      visible: true,
      pointer: { x: 0, y: 0, active: false },
      key: canvas.dataset.scene,
    };
    const owner = canvas.closest("button") || dialog;
    owner.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerType === "touch") return;
        const bounds = canvas.getBoundingClientRect();
        item.pointer = {
          x: clamp(
            ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
            -1,
            1,
          ),
          y: clamp(
            ((event.clientY - bounds.top) / bounds.height) * 2 - 1,
            -1,
            1,
          ),
          active: true,
        };
        if (paused || media.matches) drawAll(performance.now());
      },
      { passive: true },
    );
    owner.addEventListener(
      "pointerleave",
      () => {
        item.pointer = { x: 0, y: 0, active: false };
      },
      { passive: true },
    );
    return item;
  }
  const previews = [...document.querySelectorAll("[data-scene]")]
    .map(surface)
    .filter(Boolean);
  const large = surface(document.querySelector("#large-scene"));
  function resizeSurface(item) {
    if (!item) return;
    const bounds = item.canvas.getBoundingClientRect();
    item.w = Math.max(1, bounds.width);
    item.h = Math.max(1, bounds.height);
    item.dpr = Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.5 : 2);
    item.canvas.width = Math.round(item.w * item.dpr);
    item.canvas.height = Math.round(item.h * item.dpr);
  }
  function background(item, t, phase) {
    const { ctx, w, h, key } = item;
    const count =
      key === "pulso"
        ? 160
        : key === "orbita"
          ? 90
          : key === "prisma"
            ? 32
            : 12;
    const alpha = phase !== null ? 1 - ease(0.55, 0.9, phase) : 1;
    if (alpha <= 0) return;
    const shift = phase !== null ? (1 - ease(0.05, 0.5, phase)) * 0.4 : 0;
    for (let i = 0; i < count; i++) {
      const depth = 0.3 + noise(i + 420) * 0.7;
      const x =
        (noise(i + 110) * w + Math.sin(t * 0.07 + i) * 13 * depth + w) % w;
      const y =
        (noise(i + 320) * h + Math.cos(t * 0.06 + i) * 10 * depth + h) % h;
      kit.spark(
        ctx,
        (x - w / 2) * (1 + shift) + w / 2,
        (y - h / 2) * (1 + shift) + h / 2,
        (1.8 + depth * 3.8) * (w < 500 ? 0.8 : 1),
        i % 5,
        alpha * (0.18 + depth * 0.42),
      );
    }
  }
  function draw(item, t, phase = null, isLarge = false) {
    if (!item || !kit) return;
    const { ctx, w, h, dpr } = item;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.clearRect(0, 0, w, h);
    background(item, t, phase);
    ctx.save();
    let sceneHeight = h;
    if (isLarge && phase === null) {
      sceneHeight = innerWidth < 620 ? h * 0.65 : h * 0.79;
      ctx.translate(0, innerWidth < 620 ? 25 : -12);
    }
    try {
      const renderer = modules[item.key];
      if (renderer)
        renderer.draw(
          ctx,
          w,
          sceneHeight,
          t,
          media.matches ? { x: 0, y: 0, active: false } : item.pointer,
          kit,
          phase,
        );
      else
        kit.logo(ctx, {
          x: w / 2,
          y: sceneHeight / 2,
          size: Math.min(w, sceneHeight) * 0.6,
        });
    } catch (error) {
      if (!failed) {
        console.error(error);
        failed = true;
      }
      kit.logo(ctx, {
        x: w / 2,
        y: sceneHeight / 2,
        size: Math.min(w, sceneHeight) * 0.5,
      });
    }
    ctx.restore();
  }
  function drawAll(now) {
    if (!kit) return;
    if (active) {
      const intro = dialog.classList.contains("is-intro");
      const phase = intro ? clamp((now - introStart) / 3600) : null;
      skip.hidden = !intro || now - introStart < 500;
      draw(
        large,
        intro ? (now - introStart) / 1000 : animatedTime,
        phase,
        true,
      );
      if (intro && phase >= 1) finishIntro();
    } else
      for (const item of previews) if (item.visible) draw(item, animatedTime);
  }
  function tick(now) {
    frame = 0;
    if (document.hidden || paused || media.matches) return;
    const delta = now - lastFrame;
    if (delta >= (innerWidth < 700 ? 1000 / 30 : 1000 / 40) - 1) {
      animatedTime += Math.min(delta / 1000, 0.06);
      lastFrame = now;
      drawAll(now);
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = performance.now();
    if (!document.hidden) {
      drawAll(lastFrame);
      if (!paused && !media.matches) frame = requestAnimationFrame(tick);
    }
    motionButton.setAttribute("aria-pressed", String(paused));
    motionButton.innerHTML = paused
      ? "Activar movimiento <span>↻</span>"
      : "Pausar movimiento <span>Ⅱ</span>";
    motionButton.disabled = media.matches;
    if (media.matches) motionButton.textContent = "Movimiento reducido";
  }
  function finishIntro() {
    clearTimeout(introTimer);
    introTimer = 0;
    dialog.classList.remove("is-intro");
    document.querySelector("#concept-copy").inert = false;
    skip.hidden = true;
    if (skip === document.activeElement)
      document.querySelector("#replay").focus({ preventScroll: true });
    drawAll(performance.now());
  }
  function play() {
    clearTimeout(introTimer);
    if (media.matches || paused || !kit) {
      finishIntro();
      return;
    }
    introStart = performance.now();
    dialog.classList.add("is-intro");
    document.querySelector("#concept-copy").inert = true;
    skip.hidden = true;
    introTimer = setTimeout(finishIntro, 3600);
    sync();
  }
  function open(key, trigger) {
    if (!keys.includes(key) || !large) return;
    if (!dialog.open) {
      previousFocus = trigger || document.activeElement;
      dialog.showModal();
    }
    active = key;
    large.key = key;
    large.pointer = { x: 0, y: 0, active: false };
    dialog.dataset.direction = key;
    const number = String(keys.indexOf(key) + 1).padStart(2, "0");
    document.querySelector("#view-label").textContent =
      `${number} / ${names[key]}`;
    document.querySelector("#view-note").textContent = notes[key];
    document.querySelector("#view-title").textContent = "OTRORAYO";
    document
      .querySelectorAll("[data-switch]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.switch === key),
        ),
      );
    document.querySelector("#review-status").textContent =
      `Propuesta ${number}: ${names[key]}`;
    history.replaceState(null, "", `#${key}`);
    resizeSurface(large);
    play();
    document.querySelector("#close-view").focus({ preventScroll: true });
  }
  document
    .querySelectorAll("[data-open]")
    .forEach((button) =>
      button.addEventListener("click", () => open(button.dataset.open, button)),
    );
  document
    .querySelectorAll("[data-switch]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        open(button.dataset.switch, button),
      ),
    );
  document
    .querySelector("#close-view")
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    active = null;
    clearTimeout(introTimer);
    introTimer = 0;
    dialog.classList.remove("is-intro");
    history.replaceState(null, "", location.pathname + location.search);
    previousFocus?.focus({ preventScroll: true });
    sync();
  });
  document.querySelector("#replay").addEventListener("click", play);
  skip.addEventListener("click", finishIntro);
  motionButton.addEventListener("click", () => {
    paused = !paused;
    sync();
  });
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", () => {
    cancelAnimationFrame(frame);
    clearTimeout(introTimer);
    frame = 0;
  });
  window.addEventListener("pageshow", sync);
  media.addEventListener("change", () => {
    if (media.matches && active) finishIntro();
    sync();
  });
  window.addEventListener(
    "resize",
    () => {
      previews.forEach(resizeSurface);
      if (dialog.open) resizeSurface(large);
      sync();
    },
    { passive: true },
  );
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const item = previews.find((s) => s.canvas === entry.target);
          if (item) {
            item.visible = entry.isIntersecting;
            if (item.visible) draw(item, animatedTime);
          }
        }
      },
      { rootMargin: "80px" },
    );
    previews.forEach((item) => observer.observe(item.canvas));
  }
  previews.forEach(resizeSurface);
  const source = new Image();
  source.onload = () => {
    try {
      kit = prepare(source);
    } catch {
      failed = true;
      document.querySelector("#review-status").textContent =
        "No se pudieron iniciar las escenas.";
      return;
    }
    document.body.dataset.scenesReady = "true";
    sync();
    const requested = location.hash.slice(1);
    if (keys.includes(requested)) open(requested);
  };
  source.onerror = () => {
    document.querySelector("#review-status").textContent =
      "No se pudo cargar el logo.";
  };
  source.src = "assets/images/otrorayo-instagram.jpg";
})();
