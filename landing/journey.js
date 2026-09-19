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
      const surface = window.OtrorayoSpace?.create();
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
        const visible = blend(0.16, 0.7, p) * (1 - blend(2.45, 3, p) * 0.6);
        if (surface?.render(p, time, pointer, visible)) return;
        if (visible < 0.001) return;
        const compact = width < 768;
        const arrival = blend(0, 1, p),
          gallery = blend(1, 2, p),
          closing = blend(2, 3, p);
        const cx =
          mix(width * 0.5, width * (compact ? 0.54 : 0.7), arrival) -
          gallery * width * 0.19 +
          closing * width * 0.19;
        const cy = height * (compact ? 0.61 : 0.54);
        const focal = Math.min(width * (compact ? 1.03 : 0.74), height * 1.02);
        const travel = p * 11.5;
        const yaw = Math.sin(p * 1.55) * 0.095 + pointer.x * 0.015;
        const camX = Math.sin(p * 1.4) * 1.1;
        const projection = ({ x, y, z }) => {
          const dx = x - camX,
            dz = z - travel;
          const rx = dx * Math.cos(yaw) - dz * Math.sin(yaw),
            rz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
          return {
            x: cx + (rx * focal) / Math.max(0.2, rz),
            y: cy + ((y + pointer.y * 0.06) * focal) / Math.max(0.2, rz),
            z: rz,
          };
        };
        function line(vertices, color, opacity, lineWidth = 1) {
          ctx.beginPath();
          let started = false;
          for (const v of vertices) {
            const q = projection(v);
            if (q.z < 0.65) {
              started = false;
              continue;
            }
            if (!started) {
              ctx.moveTo(q.x, q.y);
              started = true;
            } else ctx.lineTo(q.x, q.y);
          }
          ctx.globalAlpha = opacity * visible;
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth;
          ctx.stroke();
        }
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        // Bevelled spatial ribs: projected faces catch light as the camera advances.
        const face = (vertices, color, opacity) => {
          const projected = vertices.map(projection);
          if (projected.some((q) => q.z < 0.65)) return;
          ctx.beginPath();
          projected.forEach((q, i) =>
            i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y),
          );
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.globalAlpha = opacity * visible;
          ctx.fill();
        };
        ctx.globalCompositeOperation = "source-over";
        for (let rib = 8; rib >= 0; rib--) {
          const z = 9 + rib * 7.8;
          const relative = z - travel;
          if (relative < 0.85) continue;
          const fade =
            blend(0.85, 3.8, relative) * (1 - blend(28, 68, relative));
          const radius = 4.45 + Math.sin(z * 0.12) * 0.27;
          const shape = (a, r, depth) => ({
            x: Math.cos(a) * r,
            y: Math.sin(a) * r * (0.78 + Math.sin(z * 0.08) * 0.06),
            z: z + depth + Math.sin(a * 2 + rib * 0.38) * 0.44,
          });
          for (let j = 0; j < 112; j++) {
            const a = (j / 112) * Math.PI * 2,
              b = ((j + 1) / 112) * Math.PI * 2;
            const light = Math.pow(
              Math.max(0, Math.cos(a + 0.8 - time * 0.025)),
              16,
            );
            const edge = Math.pow(
              Math.max(0, Math.cos(a - 2.25 + time * 0.018)),
              30,
            );
            const tone = Math.round(24 + light * 135 + edge * 74);
            face(
              [
                shape(a, radius, 0),
                shape(b, radius, 0),
                shape(b, radius, 0.52),
                shape(a, radius, 0.52),
              ],
              `rgb(${tone * 0.58},${tone * 0.66},${tone * 0.78})`,
              fade * 0.85,
            );
            face(
              [
                shape(a, radius, 0),
                shape(b, radius, 0),
                shape(b, radius - 0.15, -0.025),
                shape(a, radius - 0.15, -0.025),
              ],
              `rgb(${tone},${Math.min(255, tone + 9)},${Math.min(255, tone + 17)})`,
              fade,
            );
            line(
              [
                shape(a, radius - 0.15, -0.025),
                shape(b, radius - 0.15, -0.025),
              ],
              "#dce9f8",
              fade * (0.09 + light * 0.65 + edge * 0.4),
              0.8,
            );
            if (light > 0.6 || edge > 0.7)
              line(
                [shape(a, radius, 0.52), shape(b, radius, 0.52)],
                palette[(rib + j) % 5],
                fade * 0.18,
                0.65,
              );
          }
        }
        ctx.globalCompositeOperation = "screen";
        // Fine longitudinal light strips converge in perspective; no particle cloud.
        for (let band = 0; band < 5; band++) {
          for (const side of [-1, 1]) {
            const vertices = [];
            for (let k = 0; k < 100; k++) {
              const z = travel + 0.9 + k * 0.65;
              const a =
                side * (0.46 + band * 0.12) +
                Math.sin(z * 0.11 + time * 0.09) * 0.025;
              vertices.push({
                x: Math.cos(a) * 4.48 * side,
                y: Math.sin(a) * 3.5,
                z,
              });
            }
            line(vertices, palette[band], 0.04, 8);
            line(vertices, palette[band], 0.26, 0.9);
          }
        }
        // Floor lines and their dim reflected counterparts anchor the camera in a space.
        for (const x of [-4.3, -2.2, 0, 2.2, 4.3]) {
          line(
            [
              { x, y: 3.25, z: travel + 1 },
              { x, y: 3.25, z: travel + 64 },
            ],
            "#b7cbdd",
            0.09,
            0.7,
          );
          line(
            [
              { x: x + 0.03, y: 3.31, z: travel + 1 },
              { x: x + 0.03, y: 3.31, z: travel + 64 },
            ],
            "#188ad9",
            0.035,
            3,
          );
        }
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, height * 0.57);
        halo.addColorStop(0, "#26476824");
        halo.addColorStop(0.4, "#13253810");
        halo.addColorStop(1, "#03040700");
        ctx.globalAlpha = visible;
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
      function ending(p) {
        const alpha = blend(2.28, 3, p);
        if (alpha < 0.001) return;
        const cx = width * (width < 768 ? 0.7 : 0.76),
          cy = height * 0.58;
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        for (let side = 0; side < 2; side++) {
          const sign = side ? 1 : -1;
          for (let c = 0; c < 5; c++) {
            ctx.beginPath();
            ctx.moveTo(cx + sign * width * 0.035, cy + sign * height * 0.04);
            ctx.bezierCurveTo(
              cx + sign * width * 0.19,
              cy + sign * height * 0.17,
              cx + sign * width * 0.36,
              cy + sign * height * 0.36 + (c - 2) * 17,
              cx + sign * width * 0.6,
              cy + sign * height * 0.6 + (c - 2) * 36,
            );
            ctx.strokeStyle = palette[c];
            ctx.globalAlpha = alpha * 0.04;
            ctx.lineWidth = 9;
            ctx.stroke();
            ctx.globalAlpha = alpha * 0.24;
            ctx.lineWidth = 0.7;
            ctx.stroke();
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
          // Under reduced motion the logo remains still, with one subdued architectural view below it.
          if (reduced.matches && target > 0.45) {
            ctx.clearRect(0, 0, width, height);
            environment(1.4);
          } else {
            environment(p);
            ending(p);
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
          surface?.destroy();
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
