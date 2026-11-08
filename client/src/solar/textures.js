import { useEffect, useState } from "react";
import { CanvasTexture, SRGBColorSpace, TextureLoader } from "three";

const cache = new Map();
const loader = new TextureLoader();

const load = (url) => {
  if (!cache.has(url)) {
    cache.set(
      url,
      loader.loadAsync(url).then((texture) => {
        texture.colorSpace = SRGBColorSpace;
        texture.anisotropy = 8;
        return texture;
      }),
    );
  }
  return cache.get(url);
};

export const useTexture = (url) => {
  const [texture, setTexture] = useState(null);
  useEffect(() => {
    let active = true;
    load(url)
      .then((t) => active && setTexture(t))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [url]);
  return texture;
};

export const usePlanetTexture = (id) => useTexture(`/textures/${id}.jpg`);

export const faintRingTexture = () => {
  if (cache.has("ring:faint")) return cache.get("ring:faint");
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 4;
  const ctx = canvas.getContext("2d");
  const bands = [0.08, 0.22, 0.31, 0.47, 0.6, 0.74, 0.93];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const near = Math.min(...bands.map((b) => Math.abs(b - t)));
    const alpha = Math.max(0, 0.35 - near * 12);
    ctx.fillStyle = `rgba(175, 215, 225, ${alpha.toFixed(3)})`;
    ctx.fillRect(i, 0, 1, 4);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  cache.set("ring:faint", texture);
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
