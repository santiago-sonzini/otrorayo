/* Escena conceptual de un evento. Cámara y geometría 3D proyectadas en Canvas. */
(() => {
  "use strict";
  const C = ["#ee3825", "#ff6b0b", "#fec306", "#77bd20", "#188ad9"];
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const noise = (n) => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const normalize = (v) => {
    const m = Math.hypot(v.x, v.y, v.z) || 1;
    return { x: v.x / m, y: v.y / m, z: v.z / m };
  };
  const cross = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  });
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  function create(canvas) {
    let ctx;
    try {
      ctx = canvas?.getContext("2d", { alpha: false });
    } catch {
      return null;
    }
    if (!ctx) return null;
    const section = canvas.closest("section"),
      art = canvas.parentElement;
    const pause = document.querySelector("#event-pause"),
      cameraButton = document.querySelector("#event-camera"),
      modeLabel = document.querySelector("#event-mode");
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let w = 1,
      h = 1,
      dpr = 1,
      compact = false,
      frame = 0,
      time = 0,
      last = 0,
      inView = false,
      userPaused = false,
      sharedPaused = false,
      intro = false,
      destroyed = false,
      pageAway = false,
      assets = null,
      mode = 0;
    let camera = { x: -6, y: 4.2, z: -15 };
    const pointer = { x: 0, y: 0 },
      target = { x: 0, y: 0 };
    const cleanups = [];
    function on(t, event, fn, opts) {
      t.addEventListener(event, fn, opts);
      cleanups.push(() => t.removeEventListener(event, fn, opts));
    }
    const glows = C.concat(["#d7e9ff"]).map((color) => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d");
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "#fff");
      grad.addColorStop(0.06, "#fff");
      grad.addColorStop(0.17, color + "d9");
      grad.addColorStop(0.45, color + "39");
      grad.addColorStop(1, color + "00");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      return c;
    });
    function resize() {
      const b = canvas.getBoundingClientRect();
      w = Math.max(1, b.width);
      h = Math.max(1, b.height);
      compact = innerWidth < 768;
      dpr = Math.min(devicePixelRatio || 1, compact ? 1.5 : 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      paint();
    }
    function destination() {
      if (mode === 1)
        return { x: 7.2 + Math.sin(time * 0.08) * 0.7, y: 3.1, z: -0.4 };
      if (mode === 2) return { x: Math.sin(time * 0.045) * 7, y: 11.2, z: -8 };
      return {
        x: Math.sin(time * 0.065 - 0.75) * 8.2,
        y: 4.2 + Math.sin(time * 0.07) * 0.65,
        z: -11 - Math.cos(time * 0.065 - 0.75) * 5,
      };
    }

    function paint() {
      if (destroyed) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#030509";
      ctx.fillRect(0, 0, w, h);
      const cam = {
        x: camera.x + pointer.x * 0.85,
        y: camera.y - pointer.y * 0.3,
        z: camera.z,
      };
      const look = { x: compact ? 0 : -1.6, y: 2.6, z: 8 };
      const forward = normalize({
        x: look.x - cam.x,
        y: look.y - cam.y,
        z: look.z - cam.z,
      });
      const right = normalize(cross({ x: 0, y: 1, z: 0 }, forward));
      const up = cross(forward, right);
      const focal = Math.min(w * 0.86, h * 1.22),
        cx = w * (compact ? 0.5 : 0.64),
        cy = h * (compact ? 0.63 : 0.61);
      function project(point) {
        const v = {
          x: point.x - cam.x,
          y: point.y - cam.y,
          z: point.z - cam.z,
        };
        const depth = dot(v, forward);
        return {
          x: cx + (dot(v, right) * focal) / Math.max(depth, 0.1),
          y: cy - (dot(v, up) * focal) / Math.max(depth, 0.1),
          z: depth,
          scale: focal / Math.max(depth, 0.1),
        };
      }
      function path(points, close = false) {
        const q = points.map(project);
        if (q.some((p) => p.z < 0.25)) return null;
        ctx.beginPath();
        q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        if (close) ctx.closePath();
        return q;
      }
      function line(points, color, width = 1, alpha = 1) {
        if (!path(points)) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.globalAlpha = alpha;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      function polygon(points, color, alpha = 1) {
        if (!path(points, true)) return;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      function spark(point, radius, color, alpha = 1) {
        const p = project(point);
        if (p.z < 0.4 || p.x < -40 || p.x > w + 40 || p.y < -40 || p.y > h + 40)
          return;
        const r = Math.max(1.2, Math.min(radius * p.scale, 32));
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = "screen";
        ctx.drawImage(glows[color], p.x - r, p.y - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
      // Dark stage haze, light hangs in the volume instead of painting the UI.
      const stage = project({ x: 0, y: 3, z: 14 });
      const haze = ctx.createRadialGradient(
        stage.x,
        stage.y,
        0,
        stage.x,
        stage.y,
        Math.max(w, h) * 0.7,
      );
      haze.addColorStop(0, "#182d4528");
      haze.addColorStop(0.4, "#0e192520");
      haze.addColorStop(1, "#03050900");
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, w, h);
      polygon(
        [
          { x: -18, y: 0, z: -12 },
          { x: 18, y: 0, z: -12 },
          { x: 18, y: 0, z: 22 },
          { x: -18, y: 0, z: 22 },
        ],
        "#0a0f16",
      );
      for (let z = -10; z <= 20; z += 3)
        line(
          [
            { x: -17, y: 0.01, z },
            { x: 17, y: 0.01, z },
          ],
          "#7691ac",
          0.5,
          0.11,
        );
      for (let x = -15; x <= 15; x += 3)
        line(
          [
            { x, y: 0.01, z: -12 },
            { x, y: 0.01, z: 22 },
          ],
          "#7691ac",
          0.5,
          0.08,
        );
      // A central path leads the camera toward the stage.
      for (const x of [-2.05, 2.05]) {
        line(
          [
            { x, y: 0.03, z: -12 },
            { x, y: 0.03, z: 11 },
          ],
          "#8298af",
          1,
          0.2,
        );
        for (let z = -10; z < 11; z += 2.5)
          spark({ x, y: 0.035, z }, 0.09, 5, 0.6);
      }
      // Raised stage, front fascia and luminous edge.
      polygon(
        [
          { x: -6.5, y: 0, z: 11 },
          { x: 6.5, y: 0, z: 11 },
          { x: 6.5, y: 0.7, z: 11 },
          { x: -6.5, y: 0.7, z: 11 },
        ],
        "#101b27",
      );
      polygon(
        [
          { x: -6.5, y: 0.7, z: 11 },
          { x: 6.5, y: 0.7, z: 11 },
          { x: 6.5, y: 0.7, z: 17 },
          { x: -6.5, y: 0.7, z: 17 },
        ],
        "#101722",
      );
      line(
        [
          { x: -6.5, y: 0.72, z: 11 },
          { x: 6.5, y: 0.72, z: 11 },
        ],
        "#a9c9e7",
        1.5,
        0.65,
      );
      // Sculpture of flowing light behind the stage, related to the arrival tunnel.
      for (let ring = 6; ring >= 0; ring--) {
        const points = [],
          radius = 2.4 + ring * 0.13,
          z = 14.1 + ring * 0.35;
        for (let i = 0; i <= 90; i++) {
          const a = (i / 90) * Math.PI * 2;
          const r = radius + Math.sin(a * 3 + time * 0.16 + ring * 0.35) * 0.08;
          points.push({
            x: Math.cos(a) * r,
            y: 3.55 + Math.sin(a) * r,
            z: z + Math.sin(a * 2 + time * 0.13) * 0.1,
          });
        }
        line(points, C[ring % 5], 5, 0.055);
        line(points, C[ring % 5], 1.1, 0.65 - ring * 0.035);
        if (ring === 0) line(points, "#e0eeff", 0.65, 0.6);
      }
      if (assets) {
        // Affine projection of the authentic white sign onto the stage screen.
        const center = project({ x: 0, y: 3.55, z: 14 }),
          px = project({ x: 1, y: 3.55, z: 14 }),
          py = project({ x: 0, y: 4.55, z: 14 });
        if (center.z > 0.5) {
          const logoSize = 2.25;
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          ctx.transform(
            ((px.x - center.x) * logoSize) / 384,
            ((px.y - center.y) * logoSize) / 384,
            (-(py.x - center.x) * logoSize) / 384,
            (-(py.y - center.y) * logoSize) / 384,
            center.x,
            center.y,
          );
          ctx.drawImage(assets.mask, -192, -192);
          ctx.restore();
        }
      }
      // White arches and ceiling filaments establish real perspective.
      for (let zi = 0; zi < 5; zi++) {
        const z = -5 + zi * 5.4,
          arch = [];
        for (let i = 0; i <= 36; i++) {
          const a = (Math.PI * i) / 36;
          arch.push({ x: Math.cos(a) * 11.4, y: 1.4 + Math.sin(a) * 8.5, z });
        }
        line(arch, "#38506a", 2, 0.22);
        line(arch, "#cfdfef", 0.7, 0.22);
        for (let j = 0; j < 5; j++) {
          const a = 0.3 + (j / 4) * (Math.PI - 0.6);
          const p = { x: Math.cos(a) * 11.4, y: 1.4 + Math.sin(a) * 8.5, z };
          spark(p, 0.11, j, 0.7);
        }
      }
      for (let band = 0; band < 5; band++) {
        const points = [];
        for (let i = 0; i <= 55; i++) {
          const z = -9 + i * 0.56;
          points.push({
            x: (band - 2) * 2.6 + Math.sin(z * 0.17 + time * 0.12 + band) * 0.4,
            y: 8.2 + Math.sin(z * 0.11 + time * 0.15 + band * 0.8) * 0.45,
            z,
          });
        }
        line(points, C[band], 4, 0.055);
        line(points, C[band], 1, 0.47);
      }
      // Moving spotlights have a translucent cone and a soft floor reflection.
      for (let i = 0; i < 5; i++) {
        const source = { x: (i - 2) * 3, y: 7.7, z: 12.2 };
        const aim = {
          x: Math.sin(time * 0.2 + i * 1.7) * 8,
          y: 0.03,
          z: 1 + Math.cos(time * 0.16 + i) * 7,
        };
        const tip = project(source),
          base = project(aim);
        if (tip.z > 0.3 && base.z > 0.3) {
          const gradient = ctx.createLinearGradient(
            tip.x,
            tip.y,
            base.x,
            base.y,
          );
          gradient.addColorStop(0, C[i] + "30");
          gradient.addColorStop(1, C[i] + "00");
          const left = project({ x: aim.x - 1.5, y: 0, z: aim.z }),
            rightPoint = project({ x: aim.x + 1.5, y: 0, z: aim.z });
          ctx.beginPath();
          ctx.moveTo(tip.x, tip.y);
          ctx.lineTo(left.x, left.y);
          ctx.lineTo(rightPoint.x, rightPoint.y);
          ctx.closePath();
          ctx.fillStyle = gradient;
          ctx.fill();
          ctx.save();
          ctx.translate(base.x, base.y);
          ctx.scale(1, 0.28);
          const r = Math.min(190, base.scale * 2.2);
          ctx.globalAlpha = 0.14;
          ctx.globalCompositeOperation = "screen";
          ctx.drawImage(glows[i], -r, -r, r * 2, r * 2);
          ctx.restore();
        }
        spark(source, 0.18, i, 0.95);
      }
      for (let i = 0; i < (compact ? 32 : 65); i++)
        spark(
          {
            x: (noise(i + 9) - 0.5) * 26,
            y: 1 + noise(i + 14) * 8 + Math.sin(time * 0.12 + i) * 0.1,
            z: -5 + noise(i + 22) * 24,
          },
          0.026,
          i % 5,
          0.23,
        );
      // The edges fall into darkness; the room remains legible behind the copy.
      const vignette = ctx.createRadialGradient(
        cx,
        h * 0.62,
        h * 0.16,
        cx,
        h * 0.62,
        Math.max(w, h) * 0.85,
      );
      vignette.addColorStop(0, "#03050900");
      vignette.addColorStop(1, "#030509bb");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);
      canvas.dataset.eventReady = "true";
    }
    const allowed = () =>
      !destroyed &&
      !pageAway &&
      inView &&
      !document.hidden &&
      !media.matches &&
      !intro &&
      !userPaused &&
      !sharedPaused &&
      !document.body.classList.contains("contact-is-open");
    function tick(now) {
      frame = 0;
      if (!allowed()) return;
      if (now - last >= (compact ? 40 : 32)) {
        const delta = last ? Math.min((now - last) / 1000, 0.07) : 0;
        time += delta;
        last = now;
        const dest = destination();
        for (const key of ["x", "y", "z"])
          camera[key] = lerp(camera[key], dest[key], 0.035);
        pointer.x = lerp(pointer.x, target.x, 0.06);
        pointer.y = lerp(pointer.y, target.y, 0.06);
        paint();
      }
      frame = requestAnimationFrame(tick);
    }
    function sync() {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      canvas.dataset.eventActive = String(allowed());
      if (pause) {
        pause.hidden = media.matches;
        pause.setAttribute("aria-pressed", String(userPaused || sharedPaused));
        pause.textContent =
          userPaused || sharedPaused ? "Reanudar ↻" : "Pausar Ⅱ";
      }
      if (allowed()) frame = requestAnimationFrame(tick);
      else if (!document.hidden) paint();
    }
    on(
      section,
      "pointermove",
      (event) => {
        if (event.pointerType === "touch" || media.matches) return;
        const b = canvas.getBoundingClientRect();
        target.x = clamp(((event.clientX - b.left) / b.width) * 2 - 1, -1, 1);
        target.y = clamp(((event.clientY - b.top) / b.height) * 2 - 1, -1, 1);
      },
      { passive: true },
    );
    on(
      section,
      "pointerleave",
      () => {
        target.x = target.y = 0;
      },
      { passive: true },
    );
    on(pause, "click", () => {
      userPaused = !(userPaused || sharedPaused);
      if (sharedPaused) sharedPaused = false;
      sync();
    });
    on(cameraButton, "click", () => {
      mode = (mode + 1) % 3;
      modeLabel.textContent = [
        "Recorrido",
        "Cerca del escenario",
        "Vista aérea",
      ][mode];
      canvas.dataset.cameraMode = String(mode);
      if (media.matches || userPaused || sharedPaused) {
        camera = destination();
        paint();
      }
    });
    on(window, "resize", resize, { passive: true });
    on(document, "visibilitychange", sync);
    on(document, "otrorayo:contact", sync);
    on(media, "change", () => {
      pointer.x = pointer.y = 0;
      camera = destination();
      sync();
    });
    on(window, "pagehide", () => {
      pageAway = true;
      sync();
    });
    on(window, "pageshow", () => {
      pageAway = false;
      sync();
    });
    let observer;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        ([entry]) => {
          inView = entry.isIntersecting;
          sync();
        },
        { rootMargin: "80px" },
      );
      observer.observe(section);
    } else inView = true;
    window.OtrorayoScene?.getAssets()
      .then((value) => {
        assets = value;
        paint();
      })
      .catch(() => {});
    canvas.hidden = false;
    art.classList.add("event-ready");
    resize();
    sync();
    return {
      available: true,
      setPaused(value) {
        sharedPaused = Boolean(value);
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
  window.OtrorayoEvent = { create };
})();
