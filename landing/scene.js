/*
 * OTRORAYO — a fragmented light signal made from the authentic logo.
 *
 * const scene = OtrorayoScene.create(canvas, { mode: "intro" | "hero", logoUrl });
 * scene.render(progress, elapsedSeconds, { x: -1…1, y: -1…1 });
 * scene.resize(); scene.destroy();
 *
 * Intro: .00–.16 faint fragments; .16–.45 scan reconstruction; .45–.72 a
 * spatial glitch pulse; .72–.90 chromatic collapse; .90–1 original white logo.
 * Hero: progress .43–.58, with time/pointer controlling the gentle camera and
 * occasional smooth glitch bursts. No solid extrusion or unrelated geometry.
 *
 * render() returns false while loading, true after painting. The canvas emits
 * otrorayo:ready when loading settles (including failure) for hosts with a
 * paused RAF. The host owns RAF, visibility, reduced motion, and resize events.
 *
 * The bitmap is read once to obtain its alpha mask and sampled logo points.
 * Six cached color textures are drawn in thin, separated strips. Mobile uses
 * 280 logo points + at most 48 fly fragments, 64 strips, and DPR <=1.5. Desktop
 * uses 440 points + at most 72 fragments, 86 strips, and DPR <=2. A file://
 * fallback uses multiply/screen blending without any pixel reads or points.
 */
(() => {
  "use strict";

  const clamp = (value, min = 0, max = 1) =>
    Math.min(max, Math.max(min, value));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, value) => {
    const t = clamp((value - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const noise = (seed) => {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
    return value - Math.floor(value);
  };
  const palette = [
    [238, 56, 37], // #ee3825
    [255, 107, 11], // #ff6b0b
    [254, 195, 6], // #fec306
    [119, 189, 32], // #77bd20
    [24, 138, 217], // #188ad9
  ];
  const colors = palette.map((color) => `rgb(${color.join(",")})`);
  const crop = 128;
  const size = 384;
  const half = size / 2;
  const sourceRadius = 169;

  function create(canvas, options = {}) {
    let context;
    try {
      context = canvas.getContext("2d", { alpha: true });
    } catch (_) {
      return null;
    }
    if (!context) return null;

    const hero = options.mode === "hero";
    const logo = new Image();
    let width = 1;
    let height = 1;
    let dpr = 1;
    let scale = 1;
    let compact = false;
    let ready = false;
    let failed = false;
    let destroyed = false;
    let lastFrame = null;
    let mask = null;
    let colorFace = null;
    let tints = [];
    let points = [];
    let blackBacked = false;

    function makeTexture(paint) {
      const texture = document.createElement("canvas");
      texture.width = texture.height = size;
      const ctx = texture.getContext("2d");
      if (!ctx) return null;
      if (blackBacked) {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, size, size);
        paint(ctx);
        ctx.fillRect(0, 0, size, size);
        ctx.globalCompositeOperation = "multiply";
        ctx.drawImage(mask, 0, 0);
      } else {
        ctx.drawImage(mask, 0, 0);
        ctx.globalCompositeOperation = "source-in";
        paint(ctx);
        ctx.fillRect(0, 0, size, size);
      }
      return texture;
    }

    function clearTextures() {
      for (const texture of [...tints, colorFace]) {
        if (texture) texture.width = texture.height = 1;
      }
      tints = [];
      colorFace = null;
    }

    function prepareTextures() {
      if (!mask || destroyed) return;
      clearTextures();
      tints = colors.map((color) =>
        makeTexture((ctx) => {
          ctx.fillStyle = color;
        }),
      );
      colorFace = makeTexture((ctx) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, size);
        // Broad distinct bands keep the red and blue visible on the symbol,
        // rather than losing them in empty texture corners.
        colors.forEach((color, index) => {
          gradient.addColorStop(index / 5 + (index ? 0.015 : 0), color);
          gradient.addColorStop(
            (index + 1) / 5 - (index < 4 ? 0.015 : 0),
            color,
          );
        });
        ctx.fillStyle = gradient;
      });
    }

    function samplePoints(data) {
      const candidates = [];
      for (let y = 3; y < size - 3; y += 3) {
        for (let x = 3; x < size - 3; x += 3) {
          if (data[(y * size + x) * 4 + 3] < 160) continue;
          const seed = noise(x * 0.71 + y * 1.83);
          candidates.push({
            x: (x - half) / sourceRadius,
            y: (y - half) / sourceRadius,
            sx: x,
            sy: y,
            seed,
            color: Math.min(4, Math.floor((y / size) * 5)),
          });
        }
      }
      // One deterministic shuffle prevents regular rows in the sparse point layer.
      candidates.sort((a, b) => a.seed - b.seed);
      const total = Math.min(560, candidates.length);
      points = Array.from(
        { length: total },
        (_, index) =>
          candidates[Math.floor((index / total) * candidates.length)],
      );
    }

    function prepareMask() {
      const texture = document.createElement("canvas");
      texture.width = texture.height = size;
      const ctx = texture.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(logo, crop, crop, size, size, 0, 0, size, size);
      try {
        const pixels = ctx.getImageData(0, 0, size, size);
        const data = pixels.data;
        for (let i = 0; i < data.length; i += 4) {
          const luminance =
            data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
          data[i + 3] = luminance < 7 ? 0 : luminance;
          data[i] = data[i + 1] = data[i + 2] = 255;
        }
        ctx.putImageData(pixels, 0, 0);
        samplePoints(data);
      } catch (_) {
        // Tainted file:// images can still be painted and blended. The same
        // true logo strips remain colorful; only sampled points are omitted.
        blackBacked = true;
        points = [];
      }
      mask = texture;
      prepareTextures();
    }

    function resize() {
      if (destroyed) return;
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width || canvas.clientWidth || 1);
      height = Math.max(1, bounds.height || canvas.clientHeight || 1);
      compact =
        Boolean(options.lowPower) || width < 560 || window.innerWidth < 700;
      dpr = Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      // Leave room around the symbol for its own displaced light fragments.
      scale = Math.min(width * 0.285, height * 0.3);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function render(
      rawProgress = hero ? 0.48 : 0,
      elapsedSeconds = 0,
      pointer = {},
    ) {
      if (destroyed) return false;
      if (failed)
        throw new Error("The OTRORAYO logo image could not be rendered.");
      lastFrame = [rawProgress, elapsedSeconds, pointer];
      const p = clamp(Number.isFinite(rawProgress) ? rawProgress : 0);
      const time = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
      const pointerX = clamp(Number(pointer?.x) || 0, -1, 1);
      const pointerY = clamp(Number(pointer?.y) || 0, -1, 1);
      const build = hero ? 1 : smooth(0.12, 0.45, p);
      const collapse = smooth(0.72, 0.9, p);
      const white = smooth(0.735, 0.885, p);
      const original = smooth(0.835, 0.9, p);
      const active = 1 - collapse;
      const phase = (Math.sin(time * 1.08 - 0.75) + 1) / 2;
      // A rounded envelope creates one soft distortion burst every ~6 seconds.
      // Nothing toggles by frame number, so a paused frame remains stable.
      const burst = hero
        ? smooth(0.68, 0.95, phase) * 0.72
        : smooth(0.445, 0.515, p) * (1 - smooth(0.65, 0.725, p));
      const assembly = hero ? 0 : (1 - build) * smooth(0, 0.1, p);
      const distortion = (hero ? 0.055 : 0.035) + burst * (hero ? 0.19 : 0.44);
      const energy = (hero ? 1 : 0.2 + build * 0.8) * (1 - original);
      const sceneScale = scale * (1 - collapse * 0.025 + burst * 0.025);
      const angleY =
        (hero ? 0.1 + Math.sin(time * 0.25) * 0.25 : -0.43 + p * 0.58) *
          active +
        pointerX * 0.25 * active;
      const angleX =
        (hero ? -0.12 + Math.sin(time * 0.18 + 0.4) * 0.1 : 0.21 - p * 0.26) *
          active -
        pointerY * 0.18 * active;
      const angleZ = (hero ? Math.sin(time * 0.16) * 0.025 : -0.025) * active;
      const sinX = Math.sin(angleX);
      const cosX = Math.cos(angleX);
      const sinY = Math.sin(angleY);
      const cosY = Math.cos(angleY);
      const sinZ = Math.sin(angleZ);
      const cosZ = Math.cos(angleZ);
      const centerX = width / 2;
      const centerY = height / 2;

      function project(x, y, z = 0) {
        const y1 = y * cosX - z * sinX;
        const z1 = y * sinX + z * cosX;
        const x2 = x * cosY + z1 * sinY;
        const z2 = -x * sinY + z1 * cosY;
        const x3 = x2 * cosZ - y1 * sinZ;
        const y3 = x2 * sinZ + y1 * cosZ;
        const perspective = 5.1 / (5.1 + z2);
        return {
          x: centerX + x3 * sceneScale * perspective,
          y: centerY + y3 * sceneScale * perspective,
        };
      }

      function basis(z = 0, frontOn = false) {
        if (frontOn)
          return [
            sceneScale / sourceRadius,
            0,
            0,
            sceneScale / sourceRadius,
            centerX,
            centerY,
          ];
        const epsilon = 0.02;
        const origin = project(0, 0, z);
        const x = project(epsilon, 0, z);
        const y = project(0, epsilon, z);
        const unit = sourceRadius * epsilon;
        return [
          (x.x - origin.x) / unit,
          (x.y - origin.y) / unit,
          (y.x - origin.x) / unit,
          (y.y - origin.y) / unit,
          origin.x,
          origin.y,
        ];
      }

      function drawOriginal(alpha, frontOn = true) {
        if (!ready || alpha <= 0) return;
        context.save();
        context.globalAlpha = alpha;
        context.globalCompositeOperation = "screen";
        context.transform(...basis(0, frontOn));
        context.drawImage(
          logo,
          crop,
          crop,
          size,
          size,
          -half,
          -half,
          size,
          size,
        );
        context.restore();
      }

      function drawStripe(
        texture,
        y,
        heightInTexture,
        xOffset,
        z,
        alpha,
        colorBlend = false,
        yOffset = 0,
      ) {
        if (!texture || alpha <= 0 || y >= size) return;
        const h = Math.min(heightInTexture, size - y);
        context.save();
        context.globalAlpha = clamp(alpha);
        context.globalCompositeOperation =
          blackBacked || colorBlend ? "screen" : "source-over";
        context.transform(...basis(z));
        context.drawImage(
          texture,
          0,
          y,
          size,
          h,
          -half + xOffset,
          -half + y + yOffset,
          size,
          h,
        );
        context.restore();
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";
      context.shadowBlur = 0;
      context.clearRect(0, 0, width, height);
      if (!ready) return false;
      if (
        !mask ||
        !colorFace ||
        tints.length !== 5 ||
        tints.some((texture) => !texture)
      ) {
        drawOriginal(1, p >= 0.9);
        return true;
      }
      if (p >= 0.9) {
        drawOriginal(1, true);
        return true;
      }

      const pitch = compact ? 6 : 4.5;
      const stripHeight = compact ? 2.25 : 1.85;
      const stripCount = Math.ceil(size / pitch);
      const reveal = hero ? 1 : 0.38 + build * 0.62;
      const scanY = hero
        ? ((time * 0.1) % 1) * size
        : smooth(0.16, 0.45, p) * size;

      // Five thin chromatic echoes, not five filled surfaces. Each color owns
      // different rows, leaving negative space inside and around the true mark.
      for (let color = 0; color < 5; color += 1) {
        const offset = color - 2;
        const z = offset * (0.06 + burst * 0.17 + assembly * 0.17) * active;
        for (let row = color; row < stripCount; row += 6) {
          const seed = noise(row * 2.19 + color * 11);
          if (seed > reveal) continue;
          const y = row * pitch;
          const separation =
            offset * (2.8 + burst * 17 + assembly * 15) * active;
          const drift =
            Math.sin(row * 1.12 + color) * distortion * sourceRadius * active;
          const alpha =
            (0.32 + burst * 0.27 + (1 - build) * 0.08) * energy * (1 - white);
          drawStripe(
            tints[color],
            y,
            stripHeight * 0.66,
            separation + drift,
            z,
            alpha,
            true,
          );
        }
      }

      // Most of the logo is a separated raster. The rows slide in coherent
      // bands; the gaps persist even between glitches, so it never becomes a tube.
      for (let row = 0; row < stripCount; row += 1) {
        const seed = noise(row * 3.17 + 4);
        if (seed > reveal || (row % 11 === 8 && white < 0.55)) continue;
        const y = row * pitch;
        const group = Math.floor(row / 5);
        const direction = noise(group + 1.3) * 2 - 1;
        const tear =
          direction *
          distortion *
          sourceRadius *
          (row % 9 < 4 ? 1 : 0.12) *
          active;
        const assembling = (noise(row * 7.13) * 2 - 1) * assembly * 86;
        const yOffset = (y - half) * assembly * 0.32;
        const z =
          Math.sin(group * 1.4) *
          (0.09 + burst * 0.46 + assembly * 0.42) *
          active;
        const scan = Math.max(0, 1 - Math.abs(y - scanY) / 19);
        const alpha = energy * (0.94 + seed * 0.08 + scan * 0.18);
        const xOffset = tear + assembling;
        drawStripe(
          colorFace,
          y,
          stripHeight,
          xOffset,
          z,
          alpha * (1 - white),
          false,
          yOffset,
        );
        if (white > 0)
          drawStripe(
            mask,
            y,
            stripHeight,
            xOffset,
            z,
            alpha * white,
            false,
            yOffset,
          );
        // A narrow white core sits inside selected colored scans. It raises
        // local luminance without filling any gap or flashing the full logo.
        if ((row % 5 === 2 || scan > 0.45) && white < 0.95) {
          drawStripe(
            mask,
            y + stripHeight * 0.36,
            stripHeight * 0.28,
            xOffset,
            z,
            energy * (0.18 + scan * 0.23 + burst * 0.08) * (1 - white),
            true,
            yOffset,
          );
        }
        // Only a few rows carry a second short light trace during the pulse.
        if (burst > 0.05 && row % 17 === 3) {
          drawStripe(
            tints[row % 5],
            y,
            stripHeight * 0.5,
            xOffset + direction * 22 * burst * active,
            z - 0.06 * active,
            burst * energy * 0.43,
            true,
            yOffset,
          );
        }
      }

      // These points are sampled only from bright pixels of the original logo.
      // They break up the solid strokes rather than adding a generic starfield.
      const pointCount = Math.min(points.length, compact ? 280 : 440);
      context.globalCompositeOperation = "screen";
      for (let i = 0; i < pointCount; i += 1) {
        const point = points[Math.floor((i / pointCount) * points.length)];
        const wave = Math.sin(point.seed * 40 + time * 0.72);
        const scatter = assembly * 0.4 + burst * 0.1;
        const x =
          point.x + (point.seed - 0.5) * scatter + wave * 0.006 * active;
        const y = point.y + Math.cos(point.seed * 31) * scatter * 0.48;
        const z =
          (point.seed - 0.5) * (0.24 + burst * 0.58 + assembly * 0.6) * active;
        const projected = project(x, y, z);
        const pointSize = compact
          ? 0.65 + point.seed * 0.7
          : 0.65 + point.seed * 0.85;
        context.globalAlpha = (0.4 + point.seed * 0.46) * energy * (1 - white);
        context.fillStyle = i % 19 === 0 ? "#fff" : colors[point.color];
        context.fillRect(
          projected.x,
          projected.y,
          pointSize * (i % 13 === 0 ? 2.6 : 1),
          pointSize,
        );
      }
      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";

      // A bounded set of real-logo pixel fragments rushes into position. It
      // exists only while the intro is forming or during its spatial pulse.
      const flyEnergy = hero
        ? 0
        : (assembly * smooth(0.035, 0.16, p) + burst * 0.25) * active;
      const flyCount = Math.min(points.length, compact ? 48 : 72);
      if (flyEnergy > 0.012) {
        for (let i = 0; i < flyCount; i += 1) {
          const point = points[Math.floor((i / flyCount) * points.length)];
          const radial = 1 + flyEnergy * (0.55 + point.seed * 0.6);
          const projected = project(
            point.x * radial,
            point.y * radial,
            (point.seed - 0.5) * flyEnergy * 1.6,
          );
          const alpha = Math.min(0.68, flyEnergy * 1.08) * (1 - original);
          const pixelScale = sceneScale / sourceRadius;
          context.globalAlpha = alpha;
          context.globalCompositeOperation = blackBacked
            ? "screen"
            : "source-over";
          context.drawImage(
            tints[point.color],
            point.sx - 2,
            point.sy - 1,
            5,
            2,
            projected.x - 2 * pixelScale,
            projected.y - pixelScale,
            (5 + flyEnergy * 9) * pixelScale,
            2 * pixelScale,
          );
        }
      }
      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";
      drawOriginal(original, true);
      return true;
    }

    function announce(error = false) {
      if (destroyed) return;
      if (error) canvas.dispatchEvent(new Event("otrorayo:error"));
      canvas.dispatchEvent(new Event("otrorayo:ready"));
    }

    logo.onload = () => {
      if (destroyed) return;
      ready = true;
      try {
        prepareMask();
      } catch (_) {
        clearTextures();
        mask = null;
        points = [];
      }
      try {
        if (lastFrame) render(...lastFrame);
      } catch (_) {
        failed = true;
        announce(true);
        return;
      }
      announce();
    };
    logo.onerror = () => {
      failed = true;
      announce(true);
    };
    resize();
    logo.src = options.logoUrl || "assets/images/otrorayo-instagram.jpg";

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      logo.onload = null;
      logo.onerror = null;
      logo.removeAttribute("src");
      clearTextures();
      if (mask) mask.width = mask.height = 1;
      mask = null;
      points = [];
      lastFrame = null;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
    }

    return { render, resize, destroy };
  }

  window.OtrorayoScene = Object.freeze({ create });
})();
