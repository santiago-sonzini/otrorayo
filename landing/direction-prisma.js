/*
 * PRISMA — five authentic logo planes in an optical depth tunnel.
 * Standalone comparison direction. The host owns its canvas, RAF and logo kit.
 * draw(ctx, width, height, seconds, pointer, kit, phase)
 * phase=null: continuous preview. phase=0…1: 3.6-second entrance storyboard.
 * At most six logo draws per frame. No listeners, assets or dependencies.
 */
(() => {
  "use strict";

  function draw(ctx, width, height, seconds, pointer, kit, phase) {
    if (!width || !height || !kit?.logo) return;
    const clamp = kit.clamp;
    const ease = kit.ease;
    const intro = typeof phase === "number" && Number.isFinite(phase);
    const p = intro ? clamp(phase, 0, 1) : 0;
    const time = Number.isFinite(seconds) ? seconds : 0;
    const xPointer = clamp(Number(pointer?.x) || 0, -1, 1);
    const yPointer = clamp(Number(pointer?.y) || 0, -1, 1);
    const unit = Math.min(width, height);
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const closing = intro ? ease(0.6, 0.88, p) : 0;
    const white = intro ? ease(0.755, 0.88, p) : 0;
    const active = 1 - closing;

    if (intro && p >= 0.88) {
      kit.logo(ctx, {
        x: centerX,
        y: centerY,
        size: unit * 0.62,
        color: -1,
        alpha: 1,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        shear: 0,
      });
      return;
    }

    // The orbit stays far from edge-on. All five complete source silhouettes
    // remain readable, with empty space between their projected contours.
    const deployment = intro ? ease(0.2, 0.48, p) : 1;
    const arriving = intro ? 1 - ease(0.01, 0.25, p) : 0;
    const yaw =
      (intro
        ? 0.82 - ease(0.2, 0.62, p) * 0.68
        : 0.56 + Math.sin(time * 0.28) * 0.17) *
        active +
      xPointer * 0.13 * active;
    const pitch =
      (intro
        ? -0.23 + ease(0.22, 0.6, p) * 0.15
        : -0.17 + Math.cos(time * 0.23 + 0.7) * 0.085) *
        active -
      yPointer * 0.1 * active;
    const roll =
      (intro
        ? -0.22 + ease(0.05, 0.57, p) * 0.16
        : -0.075 + Math.sin(time * 0.19) * 0.065) * active;
    const gap =
      (intro ? 0.6 + deployment * 0.5 : 1 + Math.sin(time * 0.21) * 0.035) *
      active;
    const baseSize = unit * (0.54 + closing * 0.08);
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const cosRoll = Math.cos(roll);
    const sinRoll = Math.sin(roll);
    const cameraDistance = 2.95;

    // Far blue → near red is the painter's order; each is an entire real logo.
    // Perspective size changes naturally with Z, forming a clean nested tunnel.
    for (let index = 4; index >= 0; index -= 1) {
      const arrival = intro ? ease(index * 0.018, 0.19 + index * 0.018, p) : 1;
      if (arrival <= 0) continue;
      const z = (index - 2) * 0.68 * gap;
      const worldY = -z * sinPitch;
      const worldX = z * cosPitch * sinYaw;
      const worldZ = z * cosPitch * cosYaw;
      const perspective = cameraDistance / (cameraDistance + worldZ);
      const offsetX =
        (worldX * cosRoll - worldY * sinRoll) * unit * 0.13 * perspective;
      const offsetY =
        (worldX * sinRoll + worldY * cosRoll) * unit * 0.13 * perspective;
      const approach = (1 - arrival) * arriving;
      const size = Math.min(
        unit * 0.92,
        baseSize * perspective * (1 + approach * 0.2),
      );
      const alpha = (0.96 - index * 0.035) * arrival * (1 - white);

      kit.logo(ctx, {
        x: centerX + offsetX + (index - 2) * unit * 0.035 * approach,
        y: centerY + offsetY - unit * 0.1 * approach,
        size,
        color: index,
        alpha,
        rotation: roll + (index - 2) * 0.012 * approach,
        scaleX: cosYaw,
        scaleY: cosPitch,
        shear: sinPitch * sinYaw,
      });
    }

    if (white > 0) {
      kit.logo(ctx, {
        x: centerX,
        y: centerY,
        size: unit * (0.54 + closing * 0.08),
        color: -1,
        alpha: white,
        rotation: roll,
        scaleX: cosYaw,
        scaleY: cosPitch,
        shear: sinPitch * sinYaw,
      });
    }
  }

  window.OtrorayoDirections = window.OtrorayoDirections || {};
  window.OtrorayoDirections.prisma = Object.freeze({ draw });
})();
