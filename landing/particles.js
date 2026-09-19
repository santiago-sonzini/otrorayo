/* Campo decorativo de cinco colores. No captura gestos ni modifica el scroll. */
(() => {
  "use strict";

  const colors = ["#ee3825", "#ff6b0b", "#fec306", "#77bd20", "#188ad9"];
  const instances = new WeakMap();
  const emptyController = Object.freeze({
    setPaused() {},
    setIntroActive() {},
    destroy() {},
  });

  function create(canvas) {
    if (!canvas || typeof canvas.getContext !== "function")
      return emptyController;
    if (instances.has(canvas)) return instances.get(canvas);
    let context;
    try {
      context = canvas.getContext("2d", { alpha: true });
    } catch {
      return emptyController;
    }
    if (!context) return emptyController;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const lowPower =
      (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
      navigator.connection?.saveData;
    const removers = [];
    const pointer = { x: 0, y: 0, active: false };
    let particles = [];
    let sparks = [];
    let ripples = [];
    let touch = null;
    let width = 1;
    let height = 1;
    let mobile = false;
    let paused = false;
    let introActive = false;
    let destroyed = false;
    let failed = false;
    let inPage = true;
    let resizePending = false;
    let frame = 0;
    let previous = 0;
    let lastPaint = 0;

    const random = (min, max) => min + Math.random() * (max - min);
    const canAnimate = () =>
      !destroyed &&
      !failed &&
      !paused &&
      !introActive &&
      inPage &&
      !document.hidden &&
      !reducedMotion.matches;
    const on = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      removers.push(() => target.removeEventListener(type, handler, options));
    };
    const onMedia = (query, handler) => {
      if (query.addEventListener) on(query, "change", handler);
      else {
        query.addListener(handler);
        removers.push(() => query.removeListener(handler));
      }
    };
    const setCount = (count) => {
      if (canvas.dataset.particlesCount !== String(count))
        canvas.dataset.particlesCount = String(count);
    };

    function makeParticle(index) {
      const depth = random(0.35, 1);
      return {
        homeX: Math.random() * width,
        homeY: Math.random() * height,
        offsetX: 0,
        offsetY: 0,
        vx: 0,
        vy: 0,
        driftX: random(-2.4, 2.4) * depth,
        driftY: random(-1.3, 1.3) * depth,
        size: random(0.7, 1.6) * depth,
        depth,
        alpha: 0.18 + depth * 0.3,
        color: colors[index % colors.length],
        kind: index % 5 === 0 ? "square" : index % 4 === 0 ? "streak" : "point",
        angle: random(0, Math.PI * 2),
      };
    }

    function resize() {
      resizePending = false;
      const oldWidth = width;
      const oldHeight = height;
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      mobile = width < 768;
      const ratio = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = lowPower ? (mobile ? 18 : 32) : mobile ? 24 : 50;
      particles = particles.slice(0, count);
      particles.forEach((particle) => {
        particle.homeX *= width / oldWidth;
        particle.homeY *= height / oldHeight;
      });
      while (particles.length < count)
        particles.push(makeParticle(particles.length));
      setCount(reducedMotion.matches ? 0 : particles.length + sparks.length);
    }

    function clear() {
      context.clearRect(0, 0, width, height);
    }

    function stop() {
      window.cancelAnimationFrame(frame);
      frame = 0;
      previous = lastPaint = 0;
      canvas.dataset.particlesActive = "false";
    }

    function resetPointer() {
      pointer.active = false;
      touch = null;
    }

    function update(dt) {
      const damping = Math.exp(-4.4 * dt);
      particles.forEach((particle) => {
        particle.homeX += particle.driftX * dt;
        particle.homeY += particle.driftY * dt;
        if (particle.homeX < -36) particle.homeX = width + 36;
        if (particle.homeX > width + 36) particle.homeX = -36;
        if (particle.homeY < -36) particle.homeY = height + 36;
        if (particle.homeY > height + 36) particle.homeY = -36;
        let ax = -particle.offsetX * 7;
        let ay = -particle.offsetY * 7;
        if (pointer.active) {
          const dx = particle.homeX + particle.offsetX - pointer.x;
          const dy = particle.homeY + particle.offsetY - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance < 120 && distance > 0.01) {
            const force = (1 - distance / 120) ** 2 * 260 * particle.depth;
            ax += (dx / distance) * force;
            ay += (dy / distance) * force;
          }
        }
        particle.vx = (particle.vx + ax * dt) * damping;
        particle.vy = (particle.vy + ay * dt) * damping;
        particle.offsetX += particle.vx * dt;
        particle.offsetY += particle.vy * dt;
      });
      sparks.forEach((spark) => {
        spark.life -= dt;
        spark.x += spark.vx * dt;
        spark.y += spark.vy * dt;
        spark.vx *= Math.exp(-2 * dt);
        spark.vy *= Math.exp(-2 * dt);
      });
      sparks = sparks.filter((spark) => spark.life > 0);
      ripples.forEach((ripple) => {
        ripple.life -= dt;
      });
      ripples = ripples.filter((ripple) => ripple.life > 0);
      setCount(particles.length + sparks.length);
    }

    function draw() {
      clear();
      if (reducedMotion.matches || introActive) return;
      if (pointer.active && finePointer.matches) {
        const light = context.createRadialGradient(
          pointer.x,
          pointer.y,
          0,
          pointer.x,
          pointer.y,
          56,
        );
        light.addColorStop(0, "rgba(24,138,217,0.035)");
        light.addColorStop(1, "rgba(24,138,217,0)");
        context.fillStyle = light;
        context.fillRect(pointer.x - 56, pointer.y - 56, 112, 112);
        const nearby = particles
          .map((particle) => ({
            x: particle.homeX + particle.offsetX,
            y: particle.homeY + particle.offsetY,
            color: particle.color,
          }))
          .filter(
            (point) =>
              Math.hypot(point.x - pointer.x, point.y - pointer.y) < 110,
          );
        nearby.sort(
          (a, b) =>
            Math.hypot(a.x - pointer.x, a.y - pointer.y) -
            Math.hypot(b.x - pointer.x, b.y - pointer.y),
        );
        context.globalAlpha = 0.075;
        context.lineWidth = 0.6;
        // Hasta tres uniones locales, nunca una malla sobre el contenido.
        for (let i = 1; i < Math.min(nearby.length, 4); i += 1) {
          context.strokeStyle = nearby[i].color;
          context.beginPath();
          context.moveTo(nearby[i - 1].x, nearby[i - 1].y);
          context.lineTo(nearby[i].x, nearby[i].y);
          context.stroke();
        }
      }
      particles.forEach((particle) => {
        const x = particle.homeX + particle.offsetX;
        const y = particle.homeY + particle.offsetY;
        context.globalAlpha = particle.alpha;
        context.fillStyle = context.strokeStyle = particle.color;
        if (particle.kind === "square") {
          context.fillRect(
            x - particle.size,
            y - particle.size,
            particle.size * 2,
            particle.size * 2,
          );
        } else if (particle.kind === "streak") {
          const length = 3 + particle.depth * 5;
          context.lineWidth = Math.max(0.6, particle.size);
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(
            x + Math.cos(particle.angle) * length,
            y + Math.sin(particle.angle) * length,
          );
          context.stroke();
        } else {
          context.beginPath();
          context.arc(x, y, particle.size, 0, Math.PI * 2);
          context.fill();
        }
      });
      sparks.forEach((spark) => {
        context.globalAlpha = (0.26 * spark.life) / spark.duration;
        context.fillStyle = spark.color;
        context.fillRect(spark.x, spark.y, 1.5, 1.5);
      });
      ripples.forEach((ripple) => {
        const progress = 1 - ripple.life / 0.75;
        context.globalAlpha = (1 - progress) * 0.12;
        context.strokeStyle = colors[4];
        context.lineWidth = 0.7;
        context.beginPath();
        context.arc(ripple.x, ripple.y, 8 + progress * 34, 0, Math.PI * 2);
        context.stroke();
      });
      context.globalAlpha = 1;
    }

    function paint() {
      try {
        draw();
        return true;
      } catch {
        failed = true;
        stop();
        canvas.hidden = true;
        canvas.dataset.particlesReady = "false";
        return false;
      }
    }

    function tick(now) {
      frame = 0;
      if (!canAnimate()) return;
      if (resizePending) resize();
      const interval = 1000 / (mobile || lowPower ? 30 : 45);
      const elapsed = now - lastPaint;
      if (!lastPaint || elapsed >= interval - 0.5) {
        update(
          previous ? Math.min((now - previous) / 1000, 0.06) : interval / 1000,
        );
        previous = now;
        lastPaint = now - (elapsed % interval);
        if (!paint()) return;
      }
      frame = window.requestAnimationFrame(tick);
    }

    function synchronize() {
      if (destroyed || failed) return;
      if (reducedMotion.matches || introActive) {
        stop();
        resetPointer();
        sparks = [];
        ripples = [];
        clear();
        setCount(reducedMotion.matches ? 0 : particles.length);
      }
      if (canAnimate()) {
        canvas.hidden = false;
        canvas.dataset.particlesActive = "true";
        if (!frame) frame = window.requestAnimationFrame(tick);
      } else stop();
    }

    on(
      window,
      "pointermove",
      (event) => {
        if (!canAnimate()) return;
        if (event.pointerType === "touch") {
          if (!touch || touch.id !== event.pointerId) return;
          if (
            Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 8
          ) {
            resetPointer();
            return;
          }
        } else if (!finePointer.matches) return;
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.active = true;
      },
      { passive: true },
    );
    on(
      window,
      "pointerdown",
      (event) => {
        if (!canAnimate() || event.pointerType !== "touch") return;
        touch = { id: event.pointerId, x: event.clientX, y: event.clientY };
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.active = true;
      },
      { passive: true },
    );
    on(
      window,
      "pointerup",
      (event) => {
        if (event.pointerType === "touch") resetPointer();
      },
      { passive: true },
    );
    on(window, "pointercancel", resetPointer, { passive: true });
    on(
      window,
      "pointerout",
      (event) => {
        if (!event.relatedTarget) resetPointer();
      },
      { passive: true },
    );
    on(
      window,
      "scroll",
      () => {
        if (touch) resetPointer();
      },
      { passive: true },
    );
    on(window, "blur", resetPointer);
    on(
      window,
      "click",
      (event) => {
        if (
          !canAnimate() ||
          !finePointer.matches ||
          event.defaultPrevented ||
          event.button !== 0 ||
          !event.detail ||
          event.pointerType === "touch"
        )
          return;
        if (
          event.target.closest?.(
            "a,button,input,textarea,select,label,summary,details,[role='button'],[role='link'],[contenteditable]",
          )
        )
          return;
        for (let i = 0; i < 12; i += 1) {
          const angle = (Math.PI * 2 * i) / 12 + random(-0.1, 0.1);
          const speed = random(28, 80);
          const duration = random(0.42, 0.67);
          sparks.push({
            x: event.clientX,
            y: event.clientY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            duration,
            life: duration,
            color: colors[i % colors.length],
          });
        }
        sparks = sparks.slice(-24); // 50 puntos + 24 chispas: siempre menos de 75.
        ripples.push({ x: event.clientX, y: event.clientY, life: 0.75 });
        ripples = ripples.slice(-2);
      },
      { passive: true },
    );
    on(
      window,
      "resize",
      () => {
        resizePending = true;
        if (!canAnimate()) {
          resize();
          paint();
        }
      },
      { passive: true },
    );
    on(document, "visibilitychange", () => {
      resetPointer();
      synchronize();
    });
    onMedia(reducedMotion, synchronize);
    onMedia(finePointer, resetPointer);
    on(window, "pagehide", () => {
      inPage = false;
      stop();
    });
    on(window, "pageshow", () => {
      inPage = true;
      resizePending = true;
      synchronize();
    });

    const controller = Object.freeze({
      setPaused(value) {
        if (destroyed) return;
        paused = Boolean(value);
        if (paused) resetPointer();
        synchronize();
      },
      setIntroActive(value) {
        if (destroyed) return;
        introActive = Boolean(value);
        synchronize();
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        stop();
        removers.forEach((remove) => remove());
        particles = sparks = ripples = [];
        clear();
        canvas.hidden = true;
        canvas.dataset.particlesReady = "false";
        setCount(0);
        instances.delete(canvas);
      },
    });
    instances.set(canvas, controller);
    resize();
    canvas.dataset.particlesReady = "true";
    canvas.hidden = false;
    paint();
    synchronize();
    return controller;
  }

  window.OtrorayoParticles = Object.freeze({ create });
})();
