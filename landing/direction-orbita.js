/* Dirección Órbita: geometría proyectada, con el logo original del kit. */
(() => {
  "use strict";

  const TAU = Math.PI * 2;
  const PALETTE = ["#ee3825", "#ff6b0b", "#fec306", "#77bd20", "#188ad9"];
  const PLANES = [
    { tilt: 1.04, yaw: 0.26, turn: -0.43, radius: 0.345 },
    { tilt: 1.2, yaw: -0.37, turn: 0.74, radius: 0.354 },
    { tilt: 0.88, yaw: 0.53, turn: 1.74, radius: 0.331 },
    { tilt: 1.14, yaw: -0.53, turn: 2.44, radius: 0.363 },
    { tilt: 0.73, yaw: 0.32, turn: -1.05, radius: 0.339 },
  ];

  const clamp = (value, min = 0, max = 1) =>
    Math.min(max, Math.max(min, value));
  const smooth = (start, end, value) => {
    const progress = clamp((value - start) / (end - start));
    return progress * progress * (3 - 2 * progress);
  };

  function projectCircle(angle, radius, rotation, camera, cx, cy, unit) {
    let x = Math.cos(angle) * radius;
    let y = Math.sin(angle) * radius;
    let z = y * rotation.sx;
    y *= rotation.cx;

    const planeX = x * rotation.cy + z * rotation.sy;
    z = -x * rotation.sy + z * rotation.cy;
    x = planeX;
    const planeY = x * rotation.sz + y * rotation.cz;
    x = x * rotation.cz - y * rotation.sz;
    y = planeY;

    const cameraX = x * camera.cy + z * camera.sy;
    z = -x * camera.sy + z * camera.cy;
    x = cameraX;
    const cameraY = y * camera.cx - z * camera.sx;
    z = y * camera.sx + z * camera.cx;
    y = cameraY;

    const perspective = 2.25 / (2.25 - z);
    return {
      x: cx + x * unit * perspective,
      y: cy + y * unit * perspective,
      z,
      perspective,
      angle,
    };
  }

  function rotation(tilt, yaw, turn) {
    return {
      sx: Math.sin(tilt),
      cx: Math.cos(tilt),
      sy: Math.sin(yaw),
      cy: Math.cos(yaw),
      sz: Math.sin(turn),
      cz: Math.cos(turn),
    };
  }

  function appendChunk(chunks, points, color, head, radius, primary) {
    if (points.length < 2) return;
    let z = 0;
    let angle = 0;
    for (const point of points) {
      z += point.z;
      angle += point.angle;
    }
    z /= points.length;
    angle /= points.length;
    const depth = clamp((z / Math.max(0.025, radius)) * 0.5 + 0.5);
    const light = Math.pow((1 + Math.cos(angle - head)) * 0.5, 14);
    chunks.push({ points, color, z, depth, light, primary });
  }

  function trace(ctx, points, offsetX = 0, offsetY = 0) {
    ctx.beginPath();
    ctx.moveTo(points[0].x + offsetX, points[0].y + offsetY);
    for (let index = 1; index < points.length; index += 1) {
      ctx.lineTo(points[index].x + offsetX, points[index].y + offsetY);
    }
  }

  function glowRing(ctx, ring, unit, alpha) {
    const width = Math.max(0.7, unit * 0.0016);
    trace(ctx, ring.points);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = ring.color;
    ctx.shadowColor = ring.color;
    ctx.shadowBlur = 12;
    ctx.lineWidth = width * 2.5;
    ctx.globalAlpha = alpha * (ring.primary ? 0.19 : 0.075);
    ctx.stroke();
    ctx.shadowBlur = 6;
    ctx.lineWidth = width * 1.5;
    ctx.globalAlpha = alpha * (ring.primary ? 0.22 : 0.08);
    ctx.stroke();
    if (ring.primary) {
      ctx.strokeStyle = "#fffdf5";
      ctx.shadowColor = "#fff8df";
      ctx.shadowBlur = 9;
      ctx.lineWidth = width * 0.7;
      ctx.globalAlpha = alpha * 0.21;
      ctx.stroke();
    }
    ctx.restore();
  }

  function strokeChunk(ctx, chunk, unit, alpha) {
    const { points, color, depth, light, primary } = chunk;
    const width = Math.max(0.65, unit * 0.0015) * (0.74 + depth * 0.62);
    const opacity = alpha * (0.2 + depth * 0.46 + light * 0.27);

    if (primary) {
      const offset = clamp(unit * 0.0013, 0.4, 0.9);
      ctx.globalAlpha = alpha * (0.12 + depth * 0.2);
      ctx.lineWidth = width * 0.72;
      ctx.strokeStyle = PALETTE[0];
      trace(ctx, points, -offset, offset * 0.2);
      ctx.stroke();
      ctx.strokeStyle = PALETTE[4];
      trace(ctx, points, offset, -offset * 0.2);
      ctx.stroke();
    }

    trace(ctx, points);
    ctx.strokeStyle = color;
    ctx.globalAlpha = opacity * 0.075;
    ctx.lineWidth = width + Math.min(7, unit * 0.012);
    ctx.stroke();
    ctx.globalAlpha = opacity * 0.17;
    ctx.lineWidth = width + 2;
    ctx.stroke();
    ctx.globalAlpha = opacity;
    ctx.lineWidth = width;
    ctx.stroke();

    if (primary || light > 0.3) {
      ctx.strokeStyle = "#fffdf6";
      ctx.globalAlpha =
        alpha *
        (primary
          ? 0.28 + depth * 0.48 + light * 0.15
          : light * (0.07 + depth * 0.25));
      ctx.lineWidth = width * (primary ? 0.66 : 0.42);
      ctx.stroke();
    }
  }

  function drawMarker(ctx, marker, unit, alpha) {
    const depth = clamp(
      (marker.z / Math.max(0.025, marker.radius)) * 0.5 + 0.5,
    );
    const size = Math.max(0.8, unit * 0.0019) * (0.8 + depth * 0.45);
    ctx.fillStyle = marker.color;
    ctx.globalAlpha = alpha * (0.06 + depth * 0.09);
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, size * 3.4, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = alpha * (0.45 + depth * 0.4);
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, size, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#fffef8";
    ctx.globalAlpha *= 0.72;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, size * 0.38, 0, TAU);
    ctx.fill();
  }

  function draw(ctx, w, h, t, pointer, kit, phase) {
    if (!ctx || !kit || typeof kit.logo !== "function" || w <= 0 || h <= 0)
      return;

    const intro = typeof phase === "number" && Number.isFinite(phase);
    const progress = intro ? clamp(phase) : 0;
    const time = intro ? progress * 3.6 : Number.isFinite(t) ? t : 0;
    const px = intro ? 0 : clamp(Number(pointer?.x) || 0, -1, 1);
    const py = intro ? 0 : clamp(Number(pointer?.y) || 0, -1, 1);
    const unit = Math.min(w, h);
    const cx = w * 0.5 + px * unit * 0.014;
    const cy = h * 0.5 + py * unit * 0.012;
    const colors = kit.colors?.length >= 5 ? kit.colors : PALETTE;
    const collapse = intro ? smooth(0.65, 0.98, progress) : 0;
    const formation = intro ? smooth(0.015, 0.36, progress) : 1;
    const orbitAlpha = intro
      ? smooth(0, 0.075, progress) * (1 - smooth(0.79, 0.985, progress))
      : 1;
    const logoAlpha = intro ? smooth(0.56, 0.91, progress) : 1;
    const size = unit * 0.245 * (intro ? 0.87 + logoAlpha * 0.13 : 1);
    const cameraYaw = intro
      ? -0.38 + TAU * smooth(0.19, 0.73, progress)
      : -0.38 + Math.sin(time * 0.12) * 0.12 + px * 0.24;
    const cameraTilt = intro
      ? -0.13 - Math.sin(progress * Math.PI) * 0.13
      : -0.13 + Math.sin(time * 0.095) * 0.065 + py * 0.17;
    const camera = rotation(cameraTilt, cameraYaw, 0);
    const chunks = [];
    const markers = [];
    const glowRings = [];

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (orbitAlpha > 0.001) {
      for (let index = 0; index < PLANES.length; index += 1) {
        const plane = PLANES[index];
        const radius = plane.radius * (1 - collapse * 0.91);
        const planeRotation = rotation(
          plane.tilt + Math.sin(time * 0.17 + index * 1.7) * 0.055,
          plane.yaw + Math.sin(time * 0.14 + index * 1.3) * 0.07,
          plane.turn +
            Math.sin(time * 0.105 + index * 0.9) * 0.1 +
            collapse * 0.46,
        );
        const coverage = 0.12 + formation * 0.88;
        const startAngle = index * 1.13 - 0.9 + time * 0.07;
        const endAngle = startAngle + TAU * coverage;
        const head = intro
          ? endAngle - 0.03
          : time * (0.23 + index * 0.016) + index * 1.57;
        // 121 projected points at full circumference, split into depth-sorted strips.
        const steps = Math.ceil(120 * coverage);
        const ringPoints = [];
        const primary = index === 0;
        let points = [];
        let previousFront = null;

        for (let step = 0; step <= steps; step += 1) {
          const angle = startAngle + (step / steps) * TAU * coverage;
          const point = projectCircle(
            angle,
            radius,
            planeRotation,
            camera,
            cx,
            cy,
            unit,
          );
          const front = point.z >= 0;
          points.push(point);
          ringPoints.push(point);

          if (
            points.length >= 9 ||
            (previousFront !== null && previousFront !== front)
          ) {
            appendChunk(chunks, points, colors[index], head, radius, primary);
            points = [point];
          }
          previousFront = front;
        }
        appendChunk(chunks, points, colors[index], head, radius, primary);
        glowRings.push({ points: ringPoints, color: colors[index], primary });

        const marker = projectCircle(
          head,
          radius,
          planeRotation,
          camera,
          cx,
          cy,
          unit,
        );
        markers.push({ ...marker, color: colors[index], radius });
      }
    }

    chunks.sort((a, b) => a.z - b.z);
    markers.sort((a, b) => a.z - b.z);

    for (const ring of glowRings) {
      glowRing(ctx, ring, unit, orbitAlpha);
    }

    for (const chunk of chunks) {
      if (chunk.z < 0) strokeChunk(ctx, chunk, unit, orbitAlpha);
    }
    for (const marker of markers) {
      if (marker.z < 0) drawMarker(ctx, marker, unit, orbitAlpha);
    }

    if (logoAlpha > 0.001) {
      ctx.globalAlpha = 1;
      ctx.shadowColor = "rgba(255, 255, 255, 0.12)";
      ctx.shadowBlur = Math.min(10, unit * 0.016);
      kit.logo(ctx, {
        x: cx,
        y: cy,
        size,
        color: -1,
        alpha: logoAlpha,
        rotation:
          -0.13 + px * 0.045 + (intro ? 0 : Math.sin(time * 0.14) * 0.022),
        scaleX: 0.95 + (intro ? 0 : px * 0.025),
        scaleY: 1,
        shear: -0.035 + px * 0.025,
      });
      ctx.shadowBlur = 0;
    }

    for (const chunk of chunks) {
      if (chunk.z >= 0) strokeChunk(ctx, chunk, unit, orbitAlpha);
    }
    for (const marker of markers) {
      if (marker.z >= 0) drawMarker(ctx, marker, unit, orbitAlpha);
    }

    ctx.restore();
  }

  window.OtrorayoDirections = window.OtrorayoDirections || {};
  window.OtrorayoDirections.orbita = { draw };
})();
