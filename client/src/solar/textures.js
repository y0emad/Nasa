import { useEffect, useState } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { fbm, hex, mix, renderPlanetPixels, TEXTURE_HEIGHT, TEXTURE_WIDTH } from "./planetPixels";

const cache = new Map();
const pending = new Map();
let worker;

const toTexture = (id, data) => {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  canvas.getContext("2d").putImageData(new ImageData(data, TEXTURE_WIDTH, TEXTURE_HEIGHT), 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  cache.set(id, texture);
  return texture;
};

const getWorker = () => {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./textureWorker.js", import.meta.url), { type: "module" });
    worker.onmessage = ({ data: { id, pixels } }) => {
      const texture = toTexture(id, pixels);
      pending.get(id)?.forEach((resolve) => resolve(texture));
      pending.delete(id);
    };
  } catch {
    worker = null;
  }
  return worker;
};

const requestTexture = (id) =>
  new Promise((resolve) => {
    if (cache.has(id)) return resolve(cache.get(id));
    if (pending.has(id)) return pending.get(id).push(resolve);
    pending.set(id, [resolve]);
    const w = getWorker();
    if (w) {
      w.postMessage(id);
    } else {
      setTimeout(() => {
        const texture = toTexture(id, renderPlanetPixels(id));
        pending.get(id)?.forEach((done) => done(texture));
        pending.delete(id);
      }, 0);
    }
  });

export const usePlanetTexture = (id) => {
  const [texture, setTexture] = useState(() => cache.get(id) ?? null);
  useEffect(() => {
    let active = true;
    requestTexture(id).then((t) => active && setTexture(t));
    return () => {
      active = false;
    };
  }, [id]);
  return texture;
};

export const ringTexture = (id) => {
  const key = `ring:${id}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 8;
  const ctx = canvas.getContext("2d");
  const faint = id !== "saturn";
  for (let i = 0; i < 512; i++) {
    const t = i / 511;
    const band = fbm(t * 40, 1.3, 2.7, 4);
    let alpha = faint ? 0.25 * band : 0.25 + band * 0.75;
    if (!faint && t > 0.62 && t < 0.67) alpha *= 0.12;
    if (t < 0.04 || t > 0.97) alpha *= 0.3;
    const shade = faint ? [170, 210, 220] : mix(hex("#8c7650"), hex("#efe2c2"), band);
    ctx.fillStyle = `rgba(${shade[0] | 0}, ${shade[1] | 0}, ${shade[2] | 0}, ${alpha.toFixed(3)})`;
    ctx.fillRect(i, 0, 1, 8);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  cache.set(key, texture);
  return texture;
};

export const glowTexture = () => {
  if (cache.has("glow")) return cache.get("glow");
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255, 220, 150, 0.9)");
  g.addColorStop(0.25, "rgba(255, 160, 60, 0.45)");
  g.addColorStop(0.6, "rgba(255, 110, 20, 0.12)");
  g.addColorStop(1, "rgba(255, 90, 0, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  cache.set("glow", texture);
  return texture;
};
