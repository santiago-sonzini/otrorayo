/* One persistent projected space. Scroll changes the camera, never the wheel physics. */
(() => {
  "use strict";
  const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
  const blend = (a, b, n) => {
    const t = clamp((n - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const mix = (a, b, t) => a + (b - a) * t;
  const palette = ["#ee3825", "#ff6b0b", "#fec306", "#77bd20", "#188ad9"];
  window.OtrorayoJourney = {
    create(particles) {
      const canvas = document.createElement("canvas");
      canvas.id = "journey-scene";
      canvas.setAttribute("aria-hidden", "true");
      document.body.insertBefore(canvas, document.querySelector("main"));
      const renderer = window.OtrorayoScene?.create(canvas, {
        mode: "journey",
      });
      if (!renderer) {
        canvas.remove();
        return null;
      }
      const ctx = canvas.getContext("2d");
      const sections = [...document.querySelectorAll("main > section")];
      const reduced = matchMedia("(prefers-reduced-motion: reduce)");
      const fine = matchMedia("(hover:hover) and (pointer:fine)");
      const original = document.querySelector("#hero-scene");
      original.hidden = false;
      let width = innerWidth,
        height = innerHeight,
        frame = 0,
        time = 0,
        last = 0,
        intro = false;
      let target = 0,
        phase = 0,
        points = [],
        routes = [],
        home = { x: width / 2, y: height * 0.38, size: height * 0.38 };
      let inPage = true,
        ready = false,
        failed = false;
      const pointer = { x: 0, y: 0 },
        mouse = { x: 0, y: 0 };
      function measure() {
        width = innerWidth;
        height = innerHeight;
        points = sections.map((s, i) =>
          i ? Math.max(1, s.offsetTop - 90) : 0,
        );
        const r = original.getBoundingClientRect();
        home = {
          x: r.left + r.width / 2,
          y: r.top + scrollY + r.height * 0.5,
          size: Math.min(r.width * 0.59, r.height * 0.66),
        };
        const docRect = (element) => {
          const bounds = element.getBoundingClientRect();
          return {
            left: bounds.left,
            right: bounds.right,
            top: bounds.top + scrollY,
            bottom: bounds.bottom + scrollY,
            height: bounds.height,
          };
        };
        const hero = docRect(sections[0]);
        const stage = docRect(document.querySelector("#experience-visual"));
        const invites = docRect(sections[2]);
        const contact = docRect(sections[3]);
        const compact = width < 768;
        const right = width - (compact ? 12 : 42);
        const left = compact ? 12 : 42;
        const start = hero.bottom - 120;
        const turn = stage.bottom + 36;
        const samples = [{ x: width * 0.72, y: start }];
        function curve(x1, y1, x2, y2, x3, y3) {
          const from = samples[samples.length - 1];
          for (let i = 1; i <= 90; i++) {
            const t = i / 90,
              u = 1 - t;
            samples.push({
              x:
                u * u * u * from.x +
                3 * u * u * t * x1 +
                3 * u * t * t * x2 +
                t * t * t * x3,
              y:
                u * u * u * from.y +
                3 * u * u * t * y1 +
                3 * u * t * t * y2 +
                t * t * t * y3,
            });
          }
        }
        curve(
          right,
          start + 70,
          right,
          stage.top - 90,
          right,
          stage.top + stage.height * 0.45,
        );
        samples.push({ x: right, y: turn });
        curve(right, turn + 70, left, turn + 20, left, invites.top + 110);
        samples.push({ x: left, y: invites.bottom - 160 });
        curve(
          left,
          invites.bottom + 20,
          right,
          contact.top + 20,
          right,
          contact.top + contact.height * 0.54,
        );
        curve(
          right,
          contact.bottom - 60,
          width * 0.7,
          contact.bottom - 48,
          width * 0.59,
          contact.bottom - 48,
        );
        routes = palette.map((color, i) => {
          const gap = (i - 2) * (compact ? 2 : 3);
          const path = new Path2D();
          samples.forEach((point, index) => {
            const previous = samples[Math.max(0, index - 1)];
            const next = samples[Math.min(samples.length - 1, index + 1)];
            const dx = next.x - previous.x,
              dy = next.y - previous.y;
            const length = Math.hypot(dx, dy) || 1;
            const x = point.x - (dy / length) * gap,
              y = point.y + (dx / length) * gap;
            if (!index) path.moveTo(x, y);
            else path.lineTo(x, y);
          });
          return { color, path };
        });
        renderer.resize();
        readScroll();
      }
      function readScroll() {
        const y = scrollY;
        let i = 0;
        while (i < points.length - 2 && y > points[i + 1]) i++;
        target = clamp(
          i + (y - points[i]) / Math.max(1, points[i + 1] - points[i]),
          0,
          3,
        );
        if (reduced.matches) phase = target;
        schedule();
      }
      function environment(p) {
        const visible = blend(0.16, 0.65, p);
        if (visible < 0.001) return;
        // Fixed document anchors: logo → experience → invitations → contact.
        // The paths move with their sections, so they never drift across the copy.
        ctx.save();
        ctx.translate(0, -scrollY);
        ctx.lineCap = "round";
        for (const { color, path } of routes) {
          ctx.strokeStyle = color;
          ctx.globalAlpha = visible * 0.025;
          ctx.lineWidth = 5;
          ctx.stroke(path);
          ctx.globalAlpha = visible * 0.34;
          ctx.lineWidth = 0.8;
          ctx.stroke(path);
        }
        ctx.restore();
      }
      function paint() {
        try {
          const p = reduced.matches ? 0 : phase;
          const dive = blend(0, 0.8, p);
          const alpha = 1 - blend(0.12, 0.64, p);
          renderer.setArrival({
            x: mix(home.x, width * (width < 768 ? 0.54 : 0.7), dive),
            y: mix(home.y, height * 0.54, dive),
            size: home.size * (1 + dive * dive * 3.1),
          });
          const isReady = renderer.render(alpha, time, pointer);
          if (isReady === false) return;
          if (!ready) {
            ready = true;
            document.body.classList.add("journey-ready");
          }
          const ratio = canvas.width / width;
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
          // Reduced motion keeps the logo and colored lines still.
          if (reduced.matches && target > 0.45) {
            ctx.clearRect(0, 0, width, height);
            environment(1.4);
          } else {
            environment(p);
          }
          canvas.dataset.phase = phase.toFixed(3);
          document.body.style.setProperty(
            "--journey-atmosphere",
            String(1 - blend(0.1, 1, phase) * 0.68),
          );
          const cards = document.querySelectorAll(".invitation-example");
          const reveal = reduced.matches ? 1 : blend(1.3, 1.95, phase);
          cards.forEach((card, i) =>
            card.style.setProperty(
              "--journey-card-y",
              `${(1 - reveal) * [70, 25, 105][i]}px`,
            ),
          );
        } catch (error) {
          failed = true;
          document.body.classList.remove("journey-ready", "journey-enabled");
          canvas.hidden = true;
          renderer.destroy();
          console.error("No se pudo iniciar el recorrido", error);
        }
      }
      const allowed = () =>
        !failed &&
        inPage &&
        !intro &&
        !document.hidden &&
        !document.body.classList.contains("contact-is-open");
      function tick(now) {
        frame = 0;
        if (!allowed()) return;
        const delta = last ? Math.min((now - last) / 1000, 0.08) : 0;
        if (now - last >= 32) {
          last = now;
          if (!reduced.matches) time += delta;
          phase += (target - phase) * (1 - Math.exp(-delta * 9));
          if (Math.abs(target - phase) < 0.001) phase = target;
          pointer.x += (mouse.x - pointer.x) * 0.06;
          pointer.y += (mouse.y - pointer.y) * 0.06;
          paint();
        }
        if (!reduced.matches || Math.abs(target - phase) > 0.001)
          frame = requestAnimationFrame(tick);
      }
      function schedule() {
        if (!allowed()) {
          cancelAnimationFrame(frame);
          frame = 0;
          last = 0;
          return;
        }
        if (reduced.matches) {
          phase = target;
          paint();
          return;
        }
        if (!frame) frame = requestAnimationFrame(tick);
      }
      canvas.addEventListener("otrorayo:ready", () => {
        paint();
        schedule();
      });
      window.addEventListener("scroll", readScroll, { passive: true });
      window.addEventListener(
        "resize",
        () => {
          measure();
          paint();
        },
        { passive: true },
      );
      window.addEventListener(
        "pointermove",
        (event) => {
          if (!fine.matches || reduced.matches) return;
          mouse.x = (event.clientX / width - 0.5) * 2;
          mouse.y = (event.clientY / height - 0.5) * 2;
        },
        { passive: true },
      );
      document.addEventListener("visibilitychange", schedule);
      document.addEventListener("otrorayo:contact", schedule);
      reduced.addEventListener("change", () => {
        phase = target;
        mouse.x = mouse.y = pointer.x = pointer.y = 0;
        paint();
        schedule();
      });
      window.addEventListener("pagehide", () => {
        inPage = false;
        schedule();
      });
      window.addEventListener("pageshow", () => {
        inPage = true;
        schedule();
      });
      document.body.classList.add("journey-enabled");
      const resizeObserver = new ResizeObserver(() => {
        measure();
        paint();
      });
      sections.forEach((s) => resizeObserver.observe(s));
      measure();
      phase = target;
      paint();
      schedule();
      return {
        setIntroActive(active) {
          intro = active;
          particles.setIntroActive(false);
          schedule();
        },
        syncArrival(seconds) {
          time = seconds;
          readScroll();
          phase = target;
          paint();
        },
      };
    },
  };
})();
