/* Pulso: el signo real como una nube de luz, con profundidad y estelas propias. */
(() => {
  "use strict";

  const cache = new WeakMap();
  const TAU = Math.PI * 2;
  const clamp = (value, min = 0, max = 1) =>
    Math.max(min, Math.min(max, value));
  const mix = (a, b, amount) => a + (b - a) * amount;
  const smooth = (start, end, value) => {
    const amount = clamp((value - start) / (end - start));
    return amount * amount * (3 - 2 * amount);
  };
  const fract = (value) => value - Math.floor(value);
  const hash = (value) => fract(Math.sin(value * 127.1 + 311.7) * 43758.5453);

  function particlesFor(points, count) {
    let sizes = cache.get(points);
    if (!sizes) {
      sizes = new Map();
      cache.set(points, sizes);
    }
    if (sizes.has(count)) return sizes.get(count);
    const particles = Array.from({ length: count }, (_, index) => {
      // Muestreo distribuido: no sigue las filas del mapa de píxeles.
      const point =
        points[Math.floor(fract(index * 0.618033988749895) * points.length)];
      const seed = Number.isFinite(point.seed) ? point.seed : hash(index + 1);
      return {
        x: point.x,
        y: point.y,
        seed,
        depth: hash(seed * 71 + index * 0.37),
        angle: hash(seed * 19 + index) * TAU,
        distance: hash(seed * 29 + index * 2),
        color: Math.floor(hash(seed * 91 + index) * 5),
        size: 0.7 + hash(seed * 43 + index) * 0.7,
        index,
      };
    });
    sizes.set(count, particles);
    return particles;
  }

  function draw(ctx, w, h, t, pointer, kit, phase) {
    if (!ctx || !w || !h || !kit) return;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    const intro = phase !== null && phase !== undefined;
    const progress = intro ? clamp(phase) : 0;
    const compact = (window.innerWidth || w) < 768;
    const size = Math.min(w * 0.87, h * 0.8, 650);
    const radius = (size * 169) / 384;
    const cx = w / 2;
    const cy = h / 2;
    const points = kit.points || [];
    const colors = kit.colors || [
      "#ee3825",
      "#ff6b0b",
      "#fec306",
      "#77bd20",
      "#188ad9",
    ];
    const ease = kit.ease || smooth;

    if (intro && progress >= 0.99) {
      kit.logo(ctx, { x: cx, y: cy, size, color: -1, alpha: 1 });
      ctx.restore();
      return;
    }
    if (!points.length) {
      ctx.restore();
      return;
    }

    const count = Math.min(points.length, compact ? 180 : 600);
    const particles = particlesFor(points, count);
    const gather = intro ? ease(0.35, 0.72, progress) : 1;
    const settle = intro ? ease(0.72, 0.91, progress) : 0;
    const fade = intro ? 1 - ease(0.9, 0.98, progress) : 1;
    const pulse = intro ? Math.sin(ease(0.72, 0.9, progress) * Math.PI) : 0;
    const pointerX = clamp(pointer?.x || 0, -1, 1);
    const pointerY = clamp(pointer?.y || 0, -1, 1);
    const pointerActive =
      Boolean(pointer) &&
      pointer.active !== false &&
      (!intro || progress < 0.76);
    const cursorX = ((pointerX + 1) * w) / 2;
    const cursorY = ((pointerY + 1) * h) / 2;
    const pointerRadius = Math.min(130, Math.max(55, size * 0.22));

    // Un halo ambiental pequeño aporta aire; nunca rellena la silueta.
    const halo = ctx.createRadialGradient(
      cx,
      cy,
      radius * 0.16,
      cx,
      cy,
      radius * 1.85,
    );
    halo.addColorStop(0, "rgba(24,138,217,0.035)");
    halo.addColorStop(0.5, "rgba(238,56,37,0.022)");
    halo.addColorStop(1, "rgba(5,5,7,0)");
    ctx.globalAlpha = fade;
    ctx.fillStyle = halo;
    ctx.fillRect(
      cx - radius * 1.85,
      cy - radius * 1.85,
      radius * 3.7,
      radius * 3.7,
    );

    function project(particle, time, atProgress, repulsion) {
      const assembly = intro ? ease(0.35, 0.72, atProgress) : 1;
      const flatten = intro ? ease(0.72, 0.91, atProgress) : 0;
      const volume = 1 - flatten;
      const breath =
        1 + (intro ? pulse * 0.032 : Math.sin(time * 0.72) * 0.017);
      const angle = particle.angle + time * 0.09 * (1 - assembly);
      const expansion =
        1 + (intro ? Math.sin(clamp(atProgress / 0.35) * Math.PI) * 0.42 : 0);
      const spread = radius * (1.2 + particle.distance * 2.15) * expansion;
      let x = mix(
        Math.cos(angle) * spread,
        particle.x * radius * breath,
        assembly,
      );
      let y = mix(
        Math.sin(angle) * spread * 0.82,
        particle.y * radius * breath,
        assembly,
      );
      let z =
        mix(
          (particle.depth - 0.5) * radius * 3.4 +
            Math.sin(time * 0.5 + particle.seed * TAU) * radius * 0.3,
          (particle.depth - 0.5) * radius * 1.04 +
            Math.sin(time * 0.6 + particle.seed * TAU) * radius * 0.065,
          assembly,
        ) * volume;
      x += Math.sin(time * 0.65 + particle.seed * 17) * 1.6 * volume;
      y += Math.cos(time * 0.58 + particle.seed * 13) * 1.6 * volume;
      const yaw =
        (0.13 + Math.sin(time * 0.25) * 0.22 + pointerX * 0.07) * volume;
      const pitch =
        (-0.07 + Math.cos(time * 0.2) * 0.085 + pointerY * 0.035) * volume;
      const rotatedX = x * Math.cos(yaw) + z * Math.sin(yaw);
      z = -x * Math.sin(yaw) + z * Math.cos(yaw);
      const rotatedY = y * Math.cos(pitch) - z * Math.sin(pitch);
      z = y * Math.sin(pitch) + z * Math.cos(pitch);
      const perspective =
        (radius * 4.5) / Math.max(radius * 1.4, radius * 4.5 + z);
      x = cx + rotatedX * perspective;
      y = cy + rotatedY * perspective;
      if (pointerActive && repulsion) {
        const dx = x - cursorX;
        const dy = y - cursorY;
        const distance = Math.hypot(dx, dy);
        if (distance > 0.01 && distance < pointerRadius) {
          const push = (1 - distance / pointerRadius) ** 2 * size * 0.095;
          x += (dx / distance) * push;
          y += (dy / distance) * push;
        }
      }
      return { x, y, z, perspective };
    }

    const projected = particles
      .map((particle) => ({
        particle,
        ...project(particle, t, progress, true),
      }))
      .sort((a, b) => b.z - a.z);
    ctx.lineCap = "round";
    ctx.globalCompositeOperation = "lighter";

    projected.forEach((point) => {
      const particle = point.particle;
      if (
        point.x < -160 ||
        point.x > w + 160 ||
        point.y < -160 ||
        point.y > h + 160
      )
        return;
      const depthLight = clamp(0.82 - point.z / (radius * 3), 0.25, 1);
      const twinkle = 0.82 + Math.sin(t * 1.2 + particle.seed * 31) * 0.18;
      const alpha = (0.62 + depthLight * 0.38) * twinkle * fade;
      const color = colors[particle.color];
      const dotSize =
        particle.size *
        point.perspective *
        (compact ? 1.15 : 1) *
        (1 + pulse * 0.3);
      const glowRadius = clamp(
        (4 + (1 - particle.depth) * 4 + particle.seed) *
          clamp(size / 480, 0.8, 1.18) *
          point.perspective *
          (1 + pulse * 0.12),
        4,
        12,
      );

      if (
        (intro && gather < 0.97 && particle.index % 2 === 0) ||
        (!intro && particle.index % 9 === 0)
      ) {
        const previous = project(
          particle,
          t - (intro ? 0.16 : 0.65),
          Math.max(0, progress - 0.045),
          false,
        );
        let tailX = previous.x;
        let tailY = previous.y;
        if (!intro) {
          const dx = previous.x - point.x;
          const dy = previous.y - point.y;
          const distance = Math.max(0.2, Math.hypot(dx, dy));
          const length = 13 + particle.depth * (compact ? 17 : 29);
          tailX = point.x + (dx / distance) * length;
          tailY = point.y + (dy / distance) * length;
        }
        const trail = ctx.createLinearGradient(tailX, tailY, point.x, point.y);
        trail.addColorStop(0, `${color}00`);
        trail.addColorStop(0.82, color);
        trail.addColorStop(1, "#ffffff");
        ctx.strokeStyle = trail;
        ctx.globalAlpha = alpha * (intro ? 0.52 : 0.46) * (1 - settle);
        ctx.lineWidth = Math.max(0.45, dotSize * 0.5);
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (typeof kit.spark === "function") {
        kit.spark(ctx, point.x, point.y, glowRadius, particle.color, alpha);
      } else {
        // Mismo núcleo blanco y borde cromático si el comparador no trae sprites.
        const glow = ctx.createRadialGradient(
          point.x,
          point.y,
          0,
          point.x,
          point.y,
          glowRadius,
        );
        glow.addColorStop(0, "#ffffff");
        glow.addColorStop(0.16, "#ffffff");
        glow.addColorStop(0.32, color);
        glow.addColorStop(0.65, `${color}55`);
        glow.addColorStop(1, `${color}00`);
        ctx.fillStyle = glow;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(point.x, point.y, glowRadius, 0, TAU);
        ctx.fill();
      }
    });

    if (intro && progress > 0.9) {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      kit.logo(ctx, {
        x: cx,
        y: cy,
        size,
        color: -1,
        alpha: ease(0.9, 0.985, progress),
      });
    }
    ctx.restore();
  }

  window.OtrorayoDirections = window.OtrorayoDirections || {};
  window.OtrorayoDirections.pulso = Object.freeze({ draw });
})();
