import { CanvasTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace } from "three";

const cache = new Map();

const canvas = (width, height) => {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
};

const random = (seed) => {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

const toTexture = (c, color, repeat) => {
  const texture = new CanvasTexture(c);
  texture.colorSpace = color ? SRGBColorSpace : NoColorSpace;
  texture.anisotropy = 8;
  if (repeat) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  return texture;
};

const normalFromHeight = (height, strength = 2, wrapX = true) => {
  const { width, height: h } = height;
  const src = height.getContext("2d").getImageData(0, 0, width, h).data;
  const out = canvas(width, h);
  const ctx = out.getContext("2d");
  const image = ctx.createImageData(width, h);
  const at = (x, y) => {
    const xx = wrapX ? (x + width) % width : Math.min(width - 1, Math.max(0, x));
    const yy = Math.min(h - 1, Math.max(0, y));
    return src[(yy * width + xx) * 4] / 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * width + x) * 4;
      image.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      image.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      image.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return out;
};

const surface = (key, width, height, draw, { strength = 2, repeat, wrapX = true } = {}) => {
  if (cache.has(key)) return cache.get(key);
  const albedo = canvas(width, height);
  const rough = canvas(width, height);
  const bump = canvas(width, height);
  const a = albedo.getContext("2d");
  const r = rough.getContext("2d");
  const b = bump.getContext("2d");
  b.fillStyle = "rgb(128,128,128)";
  b.fillRect(0, 0, width, height);
  draw({ a, r, b, width, height, rand: random(key.length * 7919 + width) });
  const result = {
    map: toTexture(albedo, true, repeat),
    roughnessMap: toTexture(rough, false, repeat),
    normalMap: toTexture(normalFromHeight(bump, strength, wrapX), false, repeat),
  };
  cache.set(key, result);
  return result;
};

const grey = (v) => `rgb(${v},${v},${v})`;

export const boosterSurface = (label) =>
  surface(`booster:${label}`, 512, 2048, ({ a, r, b, width, height, rand }) => {
    for (let x = 0; x < width; x += 64) {
      const tone = 236 + Math.floor(rand() * 8);
      a.fillStyle = `rgb(${tone},${tone + 1},${tone + 3})`;
      a.fillRect(x, 0, 64, height);
      r.fillStyle = grey(84 + Math.floor(rand() * 22));
      r.fillRect(x, 0, 64, height);
    }
    const shade = a.createLinearGradient(0, 0, width, 0);
    shade.addColorStop(0, "rgba(0,0,0,0.05)");
    shade.addColorStop(0.5, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.05)");
    a.fillStyle = shade;
    a.fillRect(0, 0, width, height);

    for (let x = 0; x < width; x += 32) {
      b.fillStyle = grey(118);
      b.fillRect(x, 0, 2, height);
      a.fillStyle = "rgba(90,96,104,0.07)";
      a.fillRect(x, 0, 1, height);
    }

    const rings = [0.03, 0.27, 0.5, 0.53, 0.78, 0.97];
    for (const k of rings) {
      const y = Math.round(height * k);
      a.fillStyle = "rgba(70,76,84,0.35)";
      a.fillRect(0, y, width, 3);
      r.fillStyle = grey(150);
      r.fillRect(0, y - 2, width, 7);
      b.fillStyle = grey(70);
      b.fillRect(0, y, width, 3);
      for (let x = 4; x < width; x += 10) {
        b.fillStyle = grey(200);
        b.fillRect(x, y - 6, 2, 2);
        b.fillRect(x, y + 7, 2, 2);
      }
    }

    const panels = [
      [0.62, 0.9, 40, 70],
      [0.12, 0.94, 30, 26],
      [0.7, 0.3, 24, 48],
      [0.36, 0.86, 20, 20],
    ];
    for (const [u, v, w, h] of panels) {
      const x = u * width;
      const y = v * height;
      a.strokeStyle = "rgba(60,66,72,0.45)";
      a.lineWidth = 2;
      a.strokeRect(x, y, w, h);
      b.strokeStyle = grey(80);
      b.lineWidth = 2;
      b.strokeRect(x, y, w, h);
    }
    a.fillStyle = "#2a2d31";
    a.fillRect(width * 0.48, height * 0.955, 46, 60);
    r.fillStyle = grey(160);
    r.fillRect(width * 0.48, height * 0.955, 46, 60);

    const soot = a.createLinearGradient(0, height, 0, height * 0.72);
    soot.addColorStop(0, "rgba(40,32,26,0.55)");
    soot.addColorStop(0.4, "rgba(60,50,40,0.18)");
    soot.addColorStop(1, "rgba(60,50,40,0)");
    a.fillStyle = soot;
    a.fillRect(0, height * 0.72, width, height * 0.28);
    for (let i = 0; i < 220; i++) {
      const x = rand() * width;
      const y = height * (0.8 + rand() * 0.2);
      const len = 30 + rand() * 160;
      a.fillStyle = `rgba(45,36,28,${0.05 + rand() * 0.16})`;
      a.fillRect(x, y - len, 1 + rand() * 4, len);
      r.fillStyle = grey(190);
      r.fillRect(x, y - len, 3, len);
    }

    if (label) {
      a.save();
      a.translate(width * 0.25, height * 0.42);
      a.rotate(-Math.PI / 2);
      a.fillStyle = "#16191c";
      a.font = `700 64px "Titillium Web", Arial, sans-serif`;
      a.textAlign = "center";
      a.textBaseline = "middle";
      a.fillText(label.toUpperCase().slice(0, 18), 0, 0, height * 0.42);
      a.restore();
    }
  });

export const upperStageSurface = () =>
  surface("upper", 512, 512, ({ a, r, b, width, height, rand }) => {
    a.fillStyle = "#eef0f2";
    a.fillRect(0, 0, width, height);
    r.fillStyle = grey(90);
    r.fillRect(0, 0, width, height);
    for (const k of [0.05, 0.5, 0.94]) {
      const y = height * k;
      a.fillStyle = "rgba(70,76,84,0.35)";
      a.fillRect(0, y, width, 3);
      b.fillStyle = grey(70);
      b.fillRect(0, y, width, 3);
    }
    for (let x = 0; x < width; x += 32) {
      b.fillStyle = grey(118);
      b.fillRect(x, 0, 2, height);
    }
    for (let i = 0; i < 40; i++) {
      a.fillStyle = `rgba(120,125,130,${rand() * 0.06})`;
      a.fillRect(rand() * width, rand() * height, 2 + rand() * 30, 2 + rand() * 30);
    }
  });

export const fairingSurface = () =>
  surface("fairing", 512, 1024, ({ a, r, b, width, height, rand }) => {
    a.fillStyle = "#f1f3f5";
    a.fillRect(0, 0, width, height);
    r.fillStyle = grey(70);
    r.fillRect(0, 0, width, height);
    for (let i = 0; i < 60; i++) {
      a.fillStyle = `rgba(150,155,160,${rand() * 0.05})`;
      a.fillRect(rand() * width, rand() * height, 4 + rand() * 50, 4 + rand() * 50);
    }
    a.fillStyle = "#1c1f22";
    a.fillRect(0, height - 18, width, 10);
    b.fillStyle = grey(60);
    b.fillRect(0, height - 18, width, 10);
    for (const x of [0, width / 2 - 2]) {
      b.fillStyle = grey(70);
      b.fillRect(x, 0, 4, height);
      a.fillStyle = "rgba(60,66,72,0.4)";
      a.fillRect(x, 0, 3, height);
    }
  });

export const carbonSurface = () =>
  surface(
    "carbon",
    256,
    256,
    ({ a, r, b, width, height }) => {
      a.fillStyle = "#17191c";
      a.fillRect(0, 0, width, height);
      r.fillStyle = grey(130);
      r.fillRect(0, 0, width, height);
      for (let y = 0; y < height; y += 8) {
        for (let x = 0; x < width; x += 8) {
          const odd = ((x + y) / 8) % 2;
          b.fillStyle = grey(odd ? 150 : 110);
          b.fillRect(x, y, 8, 8);
          a.fillStyle = odd ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.05)";
          a.fillRect(x, y, 8, 8);
        }
      }
    },
    { strength: 1.2, repeat: [6, 2] },
  );

export const nozzleSurface = (key, base, glowTop) =>
  surface(
    `nozzle:${key}`,
    256,
    256,
    ({ a, r, b, width, height }) => {
      const g = a.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, glowTop);
      g.addColorStop(0.35, base);
      g.addColorStop(1, base);
      a.fillStyle = g;
      a.fillRect(0, 0, width, height);
      r.fillStyle = grey(110);
      r.fillRect(0, 0, width, height);
      for (let x = 0; x < width; x += 4) {
        b.fillStyle = grey(x % 8 ? 150 : 100);
        b.fillRect(x, 0, 2, height);
      }
    },
    { strength: 3 },
  );

export const goldFoilSurface = () =>
  surface(
    "gold",
    256,
    256,
    ({ a, r, b, width, height, rand }) => {
      a.fillStyle = "#c9a13b";
      a.fillRect(0, 0, width, height);
      r.fillStyle = grey(70);
      r.fillRect(0, 0, width, height);
      for (let i = 0; i < 260; i++) {
        const x = rand() * width;
        const y = rand() * height;
        const s = 6 + rand() * 26;
        const tone = rand();
        a.fillStyle = `rgba(${200 + tone * 55},${150 + tone * 70},${40 + tone * 50},0.35)`;
        b.fillStyle = grey(80 + Math.floor(rand() * 120));
        a.beginPath();
        b.beginPath();
        for (let k = 0; k < 4; k++) {
          const px = x + (rand() - 0.5) * s;
          const py = y + (rand() - 0.5) * s;
          if (k === 0) {
            a.moveTo(px, py);
            b.moveTo(px, py);
          } else {
            a.lineTo(px, py);
            b.lineTo(px, py);
          }
        }
        a.fill();
        b.fill();
      }
    },
    { strength: 2.5 },
  );

export const solarCellSurface = () =>
  surface(
    "cells",
    256,
    512,
    ({ a, r, b, width, height }) => {
      a.fillStyle = "#0d1a3a";
      a.fillRect(0, 0, width, height);
      r.fillStyle = grey(55);
      r.fillRect(0, 0, width, height);
      for (let y = 0; y < height; y += 32) {
        for (let x = 0; x < width; x += 32) {
          a.fillStyle = (x + y) % 64 ? "#13244d" : "#102049";
          a.fillRect(x + 2, y + 2, 28, 28);
        }
      }
      a.fillStyle = "#9aa3ad";
      for (let y = 0; y < height; y += 32) a.fillRect(0, y, width, 2);
      for (let x = 0; x < width; x += 32) a.fillRect(x, 0, 2, height);
      b.fillStyle = grey(160);
      for (let y = 0; y < height; y += 32) b.fillRect(0, y, width, 2);
      for (let x = 0; x < width; x += 32) b.fillRect(x, 0, 2, height);
    },
    { strength: 1.5, wrapX: false },
  );

export const concreteSurface = () =>
  surface(
    "concrete",
    512,
    512,
    ({ a, r, b, width, height, rand }) => {
      a.fillStyle = "#8d8b86";
      a.fillRect(0, 0, width, height);
      r.fillStyle = grey(225);
      r.fillRect(0, 0, width, height);
      for (let i = 0; i < 9000; i++) {
        const v = 110 + Math.floor(rand() * 60);
        a.fillStyle = `rgba(${v},${v - 2},${v - 6},0.25)`;
        const s = 1 + rand() * 3;
        const x = rand() * width;
        const y = rand() * height;
        a.fillRect(x, y, s, s);
        b.fillStyle = grey(110 + Math.floor(rand() * 40));
        b.fillRect(x, y, s, s);
      }
      for (let i = 0; i < 30; i++) {
        a.fillStyle = `rgba(60,58,52,${rand() * 0.12})`;
        a.beginPath();
        a.arc(rand() * width, rand() * height, 20 + rand() * 70, 0, Math.PI * 2);
        a.fill();
      }
      for (let k = 0; k <= width; k += 256) {
        a.fillStyle = "rgba(40,40,38,0.25)";
        a.fillRect(k, 0, 2, height);
        a.fillRect(0, k, width, 2);
        b.fillStyle = grey(60);
        b.fillRect(k, 0, 2, height);
        b.fillRect(0, k, width, 2);
      }
    },
    { strength: 1.5, repeat: [4, 4] },
  );

export const groundSurface = () =>
  surface(
    "ground",
    512,
    512,
    ({ a, r, width, height, rand }) => {
      a.fillStyle = "#3d4a2b";
      a.fillRect(0, 0, width, height);
      r.fillStyle = grey(240);
      r.fillRect(0, 0, width, height);
      for (let i = 0; i < 1400; i++) {
        const tone = rand();
        a.fillStyle = `rgba(${50 + tone * 60},${62 + tone * 50},${30 + tone * 20},0.35)`;
        a.beginPath();
        a.arc(rand() * width, rand() * height, 2 + rand() * 14, 0, Math.PI * 2);
        a.fill();
      }
      for (let i = 0; i < 40; i++) {
        a.fillStyle = `rgba(110,98,70,${0.08 + rand() * 0.12})`;
        a.beginPath();
        a.arc(rand() * width, rand() * height, 20 + rand() * 50, 0, Math.PI * 2);
        a.fill();
      }
    },
    { strength: 1, repeat: [60, 60] },
  );

export const waterNormals = () => {
  if (cache.has("water")) return cache.get("water");
  const size = 256;
  const height = canvas(size, size);
  const ctx = height.getContext("2d");
  const rand = random(42);
  ctx.fillStyle = grey(128);
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 6 + rand() * 18);
    const up = rand() > 0.5;
    g.addColorStop(0, up ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)");
    g.addColorStop(1, "rgba(128,128,128,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 30, y - 30, 60, 60);
  }
  const texture = toTexture(normalFromHeight(height, 4), false, [180, 180]);
  cache.set("water", texture);
  return texture;
};

export const gridFinAlpha = () => {
  if (cache.has("gridfin")) return cache.get("gridfin");
  const c = canvas(128, 128);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 5;
  for (let k = -128; k <= 256; k += 18) {
    ctx.beginPath();
    ctx.moveTo(k, 0);
    ctx.lineTo(k + 128, 128);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(k, 128);
    ctx.lineTo(k + 128, 0);
    ctx.stroke();
  }
  ctx.lineWidth = 10;
  ctx.strokeRect(0, 0, 128, 128);
  const texture = toTexture(c, false);
  cache.set("gridfin", texture);
  return texture;
};

export const frostAlpha = () => {
  if (cache.has("frost")) return cache.get("frost");
  const c = canvas(256, 512);
  const ctx = c.getContext("2d");
  const rand = random(7);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 900; i++) {
    const x = rand() * 256;
    const y = rand() * 512;
    const s = 2 + rand() * 10;
    ctx.fillStyle = `rgba(255,255,255,${0.15 + rand() * 0.35})`;
    ctx.fillRect(x, y, s * 0.5, s * 3);
  }
  const fade = ctx.createLinearGradient(0, 0, 0, 512);
  fade.addColorStop(0, "rgba(0,0,0,0.6)");
  fade.addColorStop(0.2, "rgba(0,0,0,0)");
  fade.addColorStop(0.85, "rgba(0,0,0,0)");
  fade.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 256, 512);
  const texture = toTexture(c, false);
  cache.set("frost", texture);
  return texture;
};
