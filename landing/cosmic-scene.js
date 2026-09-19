/* Prisma / viaje: proyección 3D nativa, texturas del signo oficial.
   El host controla RAF, foco, visibilidad y movimiento reducido. */
(() => {
  "use strict";
  const COLORS = ["#ee3825", "#ff6b0b", "#fec306", "#77bd20", "#188ad9"];
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, p) => {
    const n = clamp((p - a) / (b - a));
    return n * n * (3 - 2 * n);
  };
  const noise = (n) => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const assetsCache = new Map();
  let liquidMaterial = null;
  let liquidSurface = null;
  const liquidMaps = new Map();
  function getLiquidMaterial(compact) {
    const targetSize = compact ? 2048 : 4096;
    if (liquidMaps.has(targetSize)) return liquidMaps.get(targetSize);
    if (!liquidMaterial) {
      const size = 1024,
        mask = size - 1;
      const heights = new Float32Array(size * size);
      const lattice = new Float32Array(128 * 128);
      for (let i = 0; i < lattice.length; i++) lattice[i] = noise(i + 901);
      function field(x, y, period) {
        const ix = Math.floor(x),
          iy = Math.floor(y),
          wrap = period - 1;
        let fx = x - ix,
          fy = y - iy;
        fx = fx * fx * (3 - 2 * fx);
        fy = fy * fy * (3 - 2 * fy);
        const a = lattice[(ix & wrap) + (iy & wrap) * 128];
        const b = lattice[((ix + 1) & wrap) + (iy & wrap) * 128];
        const c = lattice[(ix & wrap) + ((iy + 1) & wrap) * 128];
        const d = lattice[((ix + 1) & wrap) + ((iy + 1) & wrap) * 128];
        return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
      }
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const broad = field(x / 256, y / 256, 4);
          const fold = field(x / 64 + broad * 5, y / 64 + broad * 4, 16);
          const detail = field(x / 16 + fold * 2, y / 16, 64);
          heights[y * size + x] = broad * 0.64 + fold * 0.34 + detail * 0.02;
        }
      const pixels = new Uint32Array(size * size);
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const index = y * size + x,
            height = heights[index];
          const nx =
            (heights[y * size + ((x + 1) & mask)] -
              heights[y * size + ((x - 1) & mask)]) *
            220;
          const ny =
            (heights[((y + 1) & mask) * size + x] -
              heights[((y - 1) & mask) * size + x]) *
            220;
          const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
          const reflection = Math.pow(
            clamp((nx * -0.52 + ny * -0.32 + 0.78) * inv),
            25,
          );
          const secondary = Math.pow(
            clamp((nx * 0.68 + ny * 0.15 + 0.71) * inv),
            40,
          );
          const caustic = Math.pow(
            Math.max(
              0,
              Math.sin(height * 20 + (x * Math.PI) / 512 + (y * Math.PI) / 256),
            ),
            32,
          );
          const silver = reflection * 105 + secondary * 65 + caustic * 24;
          const tint = Math.sin((x * Math.PI) / 512 + height * 7);
          const r = Math.min(
            255,
            2 + silver * (0.83 + Math.max(0, tint) * 0.13),
          );
          const g = Math.min(255, 4 + silver * 0.95);
          const b = Math.min(
            255,
            7 + silver + Math.max(0, -tint) * caustic * 19,
          );
          pixels[index] = (255 << 24) | (b << 16) | (g << 8) | r;
        }
      liquidMaterial = pixels;
    }
    const base = document.createElement("canvas"),
      smoothMap = document.createElement("canvas");
    base.width = base.height = 1024;
    const baseContext = base.getContext("2d");
    const source = baseContext.createImageData(1024, 1024);
    new Uint32Array(source.data.buffer).set(liquidMaterial);
    baseContext.putImageData(source, 0, 0);
    smoothMap.width = smoothMap.height = targetSize;
    const mapContext = smoothMap.getContext("2d", { willReadFrequently: true });
    mapContext.imageSmoothingEnabled = true;
    mapContext.imageSmoothingQuality = "high";
    mapContext.drawImage(base, 0, 0, targetSize, targetSize);
    const map = {
      pixels: new Uint32Array(
        mapContext.getImageData(0, 0, targetSize, targetSize).data.buffer,
      ),
      size: targetSize,
    };
    liquidMaps.set(targetSize, map);
    liquidSurface = base;
    smoothMap.width = smoothMap.height = 1;
    return map;
  }
  function createLiquidTunnel() {
    const surface = document.createElement("canvas"),
      context = surface.getContext("2d");
    let pixels,
      output,
      angles,
      depths,
      shades,
      width = 0,
      height = 0;
    const twists = new Float32Array(4097),
      along = new Float32Array(4097);
    function prepare(w, h) {
      // Native physical pixels up to UHD; the former 640 px enlarged layer is gone.
      const ratio = Math.min(devicePixelRatio || 1, innerWidth < 768 ? 1.5 : 2);
      const nextW = Math.round(Math.min(3840, w * ratio));
      const nextH = Math.round((nextW * h) / w);
      if (width === nextW && height === nextH) return;
      width = surface.width = nextW;
      height = surface.height = nextH;
      pixels = context.createImageData(width, height);
      output = new Uint32Array(pixels.data.buffer);
      angles = new Float32Array(width * height);
      depths = new Uint16Array(width * height);
      shades = new Uint8Array(width * height);
      const focal = Math.max(width * 0.55, height * 0.62);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const dx = (x - width * 0.5) / focal,
            dy = (y - height * 0.5) / focal;
          const radius = Math.sqrt(dx * dx + dy * dy),
            angle = Math.atan2(dy, dx);
          const z = Math.min(12, 1.1 / Math.max(0.075, radius));
          const i = y * width + x;
          angles[i] =
            (angle / (Math.PI * 2)) * 1024 +
            Math.sin(angle * 3 + z * 0.25) * 20;
          depths[i] = Math.floor(z * 102.4);
          shades[i] = Math.floor(smooth(0.08, 0.24, radius) * 255);
        }
    }
    return {
      draw(ctx, w, h, compact, travel, time, center, alpha) {
        if (!context || alpha < 0.002) return;
        prepare(w, h);
        const material = getLiquidMaterial(compact),
          materialScale = material.size / 1024,
          wrap = material.size - 1,
          shift = material.size === 4096 ? 12 : 11;
        for (let i = 0; i < 4097; i++) {
          const z = i / 102.4,
            world = z + travel;
          twists[i] =
            z * 18 +
            Math.sin(world * 0.23) * 100 +
            Math.sin(world * 0.41 - time * 0.4) * 26;
          along[i] = Math.sin(world * 0.17) * 38 + z * 48 + travel * 70;
        }
        for (let i = 0; i < output.length; i++) {
          const slice = depths[i];
          const u = ((angles[i] + twists[slice]) * materialScale) & wrap,
            v = (along[slice] * materialScale) & wrap;
          const color = material.pixels[(v << shift) + u],
            shade = shades[i];
          if (shade === 255) output[i] = color;
          else
            output[i] =
              (255 << 24) |
              (((((color >>> 16) & 255) * shade) >> 8) << 16) |
              (((((color >>> 8) & 255) * shade) >> 8) << 8) |
              (((color & 255) * shade) >> 8);
        }
        context.putImageData(pixels, 0, 0);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(surface, 0, 0, w, h);
        const vignette = ctx.createRadialGradient(
          w / 2,
          h / 2,
          Math.min(w, h) * 0.12,
          w / 2,
          h / 2,
          Math.max(w, h) * 0.7,
        );
        vignette.addColorStop(0, "#02040800");
        vignette.addColorStop(0.55, "#02040832");
        vignette.addColorStop(1, "#020408dd");
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      },
      destroy() {
        surface.width = surface.height = 1;
        pixels = output = angles = depths = shades = null;
      },
    };
  }
  function texture(size = 384) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    return c;
  }
  // Bevel normals come from the actual mark, so highlights follow its geometry.
  // A thin rear dielectric and an opaque white face share one moving area light.
  function createLogoMaterial(mask) {
    const resolution = mask.width,
      count = resolution * resolution;
    const source = mask
      .getContext("2d")
      .getImageData(0, 0, resolution, resolution);
    const distance = new Float32Array(count);
    for (let i = 0; i < count; i++)
      distance[i] = source.data[i * 4 + 3] > 80 ? 100 : 0;
    for (let y = 1; y < resolution - 1; y++)
      for (let x = 1; x < resolution - 1; x++) {
        const i = y * resolution + x;
        distance[i] = Math.min(
          distance[i],
          distance[i - 1] + 1,
          distance[i - resolution] + 1,
          distance[i - resolution - 1] + 1.414,
        );
      }
    for (let y = resolution - 2; y > 0; y--)
      for (let x = resolution - 2; x > 0; x--) {
        const i = y * resolution + x;
        distance[i] = Math.min(
          distance[i],
          distance[i + 1] + 1,
          distance[i + resolution] + 1,
          distance[i + resolution + 1] + 1.414,
        );
      }
    const samples = [];
    for (let y = 1; y < resolution - 1; y++)
      for (let x = 1; x < resolution - 1; x++) {
        const i = y * resolution + x,
          alpha = source.data[i * 4 + 3];
        if (!alpha) continue;
        const bevel = 1 - smooth(0, 3.4, distance[i]);
        const dx = distance[i - 1] - distance[i + 1],
          dy = distance[i - resolution] - distance[i + resolution];
        const length = Math.hypot(dx, dy) || 1;
        const nx = (dx / length) * bevel * 0.92,
          ny = (dy / length) * bevel * 0.92;
        samples.push([
          i * 4,
          (x - 192) / 192,
          (y - 192) / 192,
          nx,
          ny,
          Math.sqrt(1 - nx * nx - ny * ny),
          bevel,
          alpha,
        ]);
      }
    const face = texture(),
      glass = texture();
    const fc = face.getContext("2d"),
      gc = glass.getContext("2d");
    const frontPixels = fc.createImageData(resolution, resolution),
      rearPixels = gc.createImageData(resolution, resolution);
    let lastFrame = -1;
    return {
      face,
      glass,
      update(time) {
        const frame = Math.floor(time * 30);
        if (frame === lastFrame) return;
        lastFrame = frame;
        const sweep = Math.sin(time * 0.31 - 1.3) * 1.5;
        const lx = Math.sin(time * 0.31 - 1.3) * 0.65,
          ly = -0.42,
          lz = Math.sqrt(1 - lx * lx - ly * ly);
        const hl = Math.hypot(lx, ly, lz + 1),
          hx = lx / hl,
          hy = ly / hl,
          hz = (lz + 1) / hl;
        const front = frontPixels.data,
          rear = rearPixels.data;
        for (const [i, x, y, nx, ny, nz, bevel, alpha] of samples) {
          const diffuse = Math.max(0, nx * lx + ny * ly + nz * lz);
          const specular = Math.pow(
            Math.max(0, nx * hx + ny * hy + nz * hz),
            72,
          );
          const strip = x + y * 0.44 - sweep;
          const light = Math.exp(-strip * strip * 8);
          const white = Math.min(
            255,
            199 + diffuse * 43 + specular * light * 26,
          );
          front[i] = white * 0.98;
          front[i + 1] = white * 0.991;
          front[i + 2] = white;
          front[i + 3] = alpha;
          // Schlick Fresnel (IOR ~1.5); dispersion stays confined to the bevel.
          const fresnel = 0.04 + 0.96 * Math.pow(1 - nz, 5);
          const rim = Math.pow(bevel, 0.6);
          const red = Math.exp(-Math.pow((strip - 0.1) * 6, 2));
          const green = Math.exp(-Math.pow(strip * 6, 2));
          const blue = Math.exp(-Math.pow((strip + 0.1) * 6, 2));
          rear[i] = Math.min(
            255,
            65 + fresnel * 160 + red * rim * 170 + specular * 80,
          );
          rear[i + 1] = Math.min(
            255,
            79 + fresnel * 155 + green * rim * 160 + specular * 80,
          );
          rear[i + 2] = Math.min(
            255,
            100 + fresnel * 150 + blue * rim * 155 + specular * 80,
          );
          rear[i + 3] = alpha * (0.055 + rim * 0.44 + light * rim * 0.37);
        }
        fc.putImageData(frontPixels, 0, 0);
        gc.putImageData(rearPixels, 0, 0);
      },
    };
  }
  function getAssets(url = "assets/images/otrorayo-instagram.jpg") {
    if (assetsCache.has(url)) return assetsCache.get(url);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onerror = () => reject(new Error("No se pudo cargar el logo."));
      image.onload = () => {
        try {
          const mask = texture(),
            c = mask.getContext("2d", { willReadFrequently: true });
          c.drawImage(image, 128, 128, 384, 384, 0, 0, 384, 384);
          let blackBacked = false;
          try {
            const pixels = c.getImageData(0, 0, 384, 384);
            for (let i = 0; i < pixels.data.length; i += 4) {
              const a =
                pixels.data[i] * 0.2126 +
                pixels.data[i + 1] * 0.7152 +
                pixels.data[i + 2] * 0.0722;
              pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255;
              pixels.data[i + 3] = a < 8 ? 0 : a;
            }
            c.putImageData(pixels, 0, 0);
          } catch {
            blackBacked = true;
          }
          function tint(paint) {
            const canvas = texture(),
              ctx = canvas.getContext("2d");
            ctx.drawImage(mask, 0, 0);
            ctx.globalCompositeOperation = blackBacked
              ? "multiply"
              : "source-in";
            ctx.fillStyle = typeof paint === "function" ? paint(ctx) : paint;
            ctx.fillRect(0, 0, 384, 384);
            return canvas;
          }
          function glow(source) {
            const canvas = texture(448),
              ctx = canvas.getContext("2d");
            ctx.filter = "blur(9px)";
            ctx.drawImage(source, 32, 32);
            ctx.filter = "none";
            return canvas;
          }
          const face = tint((ctx) => {
            const g = ctx.createLinearGradient(0, 0, 320, 384);
            g.addColorStop(0, "#fff");
            g.addColorStop(0.4, "#f4f8ff");
            g.addColorStop(0.74, "#c1cbd8");
            g.addColorStop(1, "#fff");
            return g;
          });
          const tints = COLORS.map(tint);
          resolve({
            mask,
            material: blackBacked ? null : createLogoMaterial(mask),
            face,
            side: tint("#687687"),
            edge: tint("#b7c7d9"),
            tints,
            glows: tints.map(glow),
            whiteGlow: glow(mask),
            blackBacked,
          });
        } catch (error) {
          reject(error);
        }
      };
      image.src = url;
    });
    assetsCache.set(url, promise);
    return promise;
  }
  function create(canvas, options = {}) {
    let ctx;
    try {
      ctx = canvas?.getContext("2d", { alpha: true });
    } catch {
      return null;
    }
    if (!ctx) return null;
    const hero = options.mode === "hero" || options.mode === "journey";
    const liquidTunnel = hero ? null : createLiquidTunnel();
    let w = 1,
      h = 1,
      dpr = 1,
      compact = false,
      assets = null,
      destroyed = false,
      error = null,
      last = null,
      arrivalLayout = null;
    function resize() {
      if (destroyed) return;
      const b = canvas.getBoundingClientRect();
      w = Math.max(1, b.width);
      h = Math.max(1, b.height);
      compact = innerWidth < 768 || options.lowPower;
      dpr = Math.min(devicePixelRatio || 1, compact ? 1.5 : 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    function stamp(
      source,
      x,
      y,
      size,
      angle = 0,
      sx = 1,
      sy = 1,
      shear = 0,
      alpha = 1,
      halo = false,
      composite = "screen",
    ) {
      if (alpha <= 0 || size < 0.2) return;
      ctx.save();
      ctx.globalAlpha = clamp(alpha);
      ctx.globalCompositeOperation = composite;
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.transform(sx, 0, shear, sy, 0, 0);
      const s = halo ? (size * 448) / 384 : size;
      ctx.drawImage(source, -s / 2, -s / 2, s, s);
      ctx.restore();
    }
    function logo(time, pointer, arrival = 1, placement = null) {
      const size = placement?.size || Math.min(w * 0.59, h * 0.66),
        x = placement?.x ?? w / 2,
        y = placement?.y ?? h * 0.5;
      // Nearly still: a small tilt reveals the edge, rather than rotating the mark.
      const yaw = 0.2 + clamp(pointer.x || 0, -1, 1) * 0.024;
      const pitch = -0.08 + clamp(pointer.y || 0, -1, 1) * 0.016;
      const roll = -0.025;
      const bob = Math.sin(time * 0.18) * 0.9;
      const sx = Math.cos(yaw),
        sy = Math.cos(pitch),
        shear = Math.sin(pitch) * Math.sin(yaw);
      const material = assets.material;
      material?.update(time);
      const depth = Math.min(13, size * 0.037),
        lightPhase = Math.sin(time * 0.31 - 1.3);
      // A soft light behind the object motivates its travelling edge reflection.
      ctx.save();
      ctx.translate(x, y + bob);
      ctx.rotate(-0.4);
      ctx.scale(1, 0.34);
      const light = ctx.createRadialGradient(
        lightPhase * size * 0.45,
        0,
        0,
        lightPhase * size * 0.45,
        0,
        size * 0.72,
      );
      light.addColorStop(0, "rgba(129,171,219,0.08)");
      light.addColorStop(0.3, "rgba(110,147,200,0.035)");
      light.addColorStop(1, "rgba(70,105,170,0)");
      ctx.globalAlpha = arrival;
      ctx.fillStyle = light;
      ctx.fillRect(-size * 1.3, -size, size * 2.6, size * 2);
      ctx.restore();
      stamp(
        assets.whiteGlow,
        x,
        y + bob,
        size,
        roll,
        sx,
        sy,
        shear,
        0.09 * arrival,
        true,
      );
      if (material) {
        // Transparent rear plate; separated faces give a readable, restrained thickness.
        for (let i = 3; i > 0; i--) {
          const z = (depth * i) / 3;
          stamp(
            material.glass,
            x + z,
            y + bob + z * 0.55,
            size * 1.012,
            roll,
            sx,
            sy,
            shear,
            arrival * (i === 3 ? 1 : 0.42),
          );
        }
      }
      for (let i = 3; i > 0; i--) {
        stamp(
          assets.side,
          x + i * depth * 0.13,
          y + bob + i * depth * 0.065,
          size,
          roll,
          sx,
          sy,
          shear,
          arrival * 0.82,
          false,
          "source-over",
        );
      }
      stamp(
        material?.face || assets.face,
        x,
        y + bob,
        size,
        roll,
        sx,
        sy,
        shear,
        arrival,
        false,
        "source-over",
      );
    }

    function energyFormation(p, time, x, y, size) {
      const focal = Math.max(w * 0.58, h * 0.64);
      const streamAlpha = smooth(0, 0.055, p) * (1 - smooth(0.36, 0.49, p));
      const converge = smooth(0.16, 0.36, p);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.lineCap = "round";
      // Two currents: five fine spectral filaments per wall, gathering into straight rays.
      if (streamAlpha > 0.005) {
        for (let side = 0; side < 2; side++) {
          const sign = side ? 1 : -1;
          for (let band = 0; band < 5; band++) {
            ctx.beginPath();
            for (let i = 0; i <= 88; i++) {
              const t = i / 88,
                z = 0.6 + t * 7.3;
              const angle =
                (side ? 0.68 : Math.PI + 0.68) +
                Math.sin(z * 0.58 - time * 0.54) * 0.47 +
                (band - 2) * 0.035;
              const wallX = w * 0.5 + (Math.cos(angle) * 1.64 * focal) / z;
              const wallY = h * 0.39 + (Math.sin(angle) * 1.64 * focal) / z;
              const diagonal = sign * 0.375 * (1 - t);
              const split = smooth(0.28, 0.39, p) * sign * 0.026;
              const sx =
                wallX * (1 - converge) +
                (x + (diagonal - split) * size) * converge;
              const sy =
                wallY * (1 - converge) +
                (y + (diagonal + split) * size) * converge;
              if (i) ctx.lineTo(sx, sy);
              else ctx.moveTo(sx, sy);
            }
            ctx.strokeStyle = COLORS[band];
            ctx.globalAlpha = streamAlpha * 0.09;
            ctx.lineWidth = 12;
            ctx.stroke();
            ctx.globalAlpha = streamAlpha * 0.78;
            ctx.lineWidth = 1.1 + converge * 1.1;
            ctx.stroke();
            ctx.strokeStyle = "#e9f5ff";
            ctx.globalAlpha = streamAlpha * 0.22;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      const solid = smooth(0.32, 0.49, p);
      ctx.restore();
      return solid;
    }
    function wormhole(p, time) {
      const m = Math.min(w, h),
        flight = smooth(0.01, 0.34, p),
        travel = flight * 3.8;
      const energy = 1 - smooth(0.19, 0.42, p),
        center = { x: w * 0.5, y: h * 0.44 };
      liquidTunnel.draw(
        ctx,
        w,
        h,
        compact,
        travel,
        time * 0.35,
        center,
        smooth(0, 0.08, p) * energy,
      );
      const dock = smooth(0.5, 0.78, p);
      const destination = arrivalLayout || {
        x: w / 2,
        y: h * 0.4,
        size: m * 0.47,
      };
      const size = m * 0.5 + (destination.size - m * 0.5) * dock;
      const x = w * 0.5 + (destination.x - w * 0.5) * dock,
        y = h * 0.35 + (destination.y - h * 0.35) * dock;
      const handoff = arrivalLayout ? smooth(0.8, 0.98, p) : smooth(0.86, 1, p);
      const solid = energyFormation(p, time, x, y, size);
      if (solid > 0) logo(time, {}, solid * (1 - handoff), { x, y, size });
    }

    function render(progress = 0, time = 0, pointer = {}) {
      if (destroyed) return false;
      if (error) throw error;
      last = [progress, time, pointer];
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);
      if (!assets) return false;
      if (hero)
        logo(
          time,
          pointer,
          options.mode === "journey" ? clamp(progress) : 1,
          options.mode === "journey" ? arrivalLayout : null,
        );
      else wormhole(clamp(progress), time);
      return true;
    }
    resize();
    getAssets(options.logoUrl)
      .then((value) => {
        if (destroyed) return;
        assets = value;
        if (last) render(...last);
        canvas.dispatchEvent(new Event("otrorayo:ready"));
      })
      .catch((reason) => {
        if (destroyed) return;
        error = reason;
        canvas.dispatchEvent(new Event("otrorayo:error"));
        canvas.dispatchEvent(new Event("otrorayo:ready"));
      });
    return {
      render,
      resize,
      setArrival(layout) {
        arrivalLayout = layout;
      },
      destroy() {
        destroyed = true;
        liquidTunnel?.destroy();
        assets = null;
        last = null;
        arrivalLayout = null;
        canvas.width = canvas.height = 1;
      },
    };
  }
  window.OtrorayoScene = {
    create,
    getAssets,
    getLiquidSurface() {
      if (!liquidSurface) getLiquidMaterial(true);
      return liquidSurface;
    },
  };
})();
