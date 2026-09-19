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
        const visible = blend(0.16, 0.72, p);
        if (visible < 0.001) return;
        const compact = width < 768;
        const arrival = blend(0, 1, p);
        const gallery = blend(1, 2, p);
        const closing = blend(2, 3, p);
        const cx =
          width *
          (0.5 +
            arrival * (compact ? 0.04 : 0.2) -
            gallery * 0.16 +
            closing * 0.12);
        const cy = height * (0.57 + closing * 0.12);
        const focal = Math.min(width * (compact ? 1.2 : 0.8), height * 1.05);
        const travel = p * 10;
        // Both ribbons share one world-space curve. Scroll advances the camera
        // along it; time only adds a slow current and travelling illumination.
        const center = (z) => Math.sin(z * 0.065) * 1.3;
        const camX = center(travel);
        const yaw = Math.cos(travel * 0.065) * 0.065 + pointer.x * 0.012;
        const project = (x, y, z) => {
          const dx = x - camX;
          const dz = z - travel;
          const rx = dx * Math.cos(yaw) - dz * Math.sin(yaw);
          const depth = dx * Math.sin(yaw) + dz * Math.cos(yaw);
          return {
            x: cx + (rx * focal) / Math.max(0.5, depth),
            y: cy + ((y + pointer.y * 0.05) * focal) / Math.max(0.5, depth),
            depth,
          };
        };
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        // A soft bloom, saturated tube and fine hot core, without white glare.
        for (const side of [0, 1]) {
          for (let band = 0; band < palette.length; band++) {
            const samples = [];
            for (let k = 0; k <= 96; k++) {
              const distance = 1.2 + k * 0.55;
              const z = travel + distance;
              const angle =
                -0.64 +
                side * Math.PI +
                z * 0.105 +
                Math.sin(z * 0.09 - time * 0.14) * 0.16 +
                (band - 2) * 0.045;
              const radius = 4.5 + Math.sin(z * 0.13) * 0.45;
              samples.push(
                project(
                  center(z) + Math.cos(angle) * radius,
                  Math.sin(angle) * radius * 0.72,
                  z,
                ),
              );
            }
            // Fade before the vanishing point so the colors never form a knot.
            for (let k = samples.length - 7; k >= 0; k -= 6) {
              const segment = samples.slice(k, k + 7);
              const depth = segment[3].depth;
              if (segment.some((q) => q.depth < 0.6)) continue;
              const fade = (1 - blend(20, 49, depth)) * visible;
              if (fade < 0.005) continue;
              const pulse = reduced.matches
                ? 0
                : Math.pow(
                    0.5 +
                      0.5 *
                        Math.cos(
                          depth * 0.32 +
                            travel * 0.32 +
                            time * 0.85 -
                            side * 1.4,
                        ),
                    10,
                  );
              const thickness = clamp(
                focal / (depth * 95),
                0.55,
                compact ? 1.9 : 2.5,
              );
              const path = new Path2D();
              path.moveTo(segment[0].x, segment[0].y);
              for (let j = 1; j < segment.length; j++)
                path.lineTo(segment[j].x, segment[j].y);
              ctx.strokeStyle = palette[band];
              for (const [spread, alpha] of [
                [15, 0.04],
                [5, 0.14],
                [1.6, 0.42],
                [0.65, 0.9],
              ]) {
                ctx.lineWidth = thickness * spread;
                ctx.globalAlpha = fade * alpha * (0.7 + pulse * 0.3);
                ctx.stroke(path);
              }
            }
          }
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
            environment(target);
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
