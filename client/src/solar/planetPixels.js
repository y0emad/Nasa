const hash = (x, y, z) => {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

const noise3 = (x, y, z) => {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
  const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), xf);
  const x10 = lerp(c(0, 1, 0), c(1, 1, 0), xf);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), xf);
  const x11 = lerp(c(0, 1, 1), c(1, 1, 1), xf);
  return lerp(lerp(x00, x10, yf), lerp(x01, x11, yf), zf);
};

export const fbm = (x, y, z, octaves = 5) => {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise3(x * freq, y * freq, z * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
};

export const hex = (value) => {
  const n = parseInt(value.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const ramp = (stops, t) => {
  const v = Math.min(0.9999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(v);
  return mix(stops[i], stops[i + 1], v - i);
};

const STYLES = {
  sun: { kind: "sun", stops: ["#b33a00", "#ff7a00", "#ffb000", "#ffe08a"] },
  mercury: { kind: "rocky", stops: ["#4a4744", "#7d7873", "#a8a39d", "#cfcac4"], craters: 1, scale: 3 },
  venus: { kind: "clouds", stops: ["#a8742f", "#d9a95b", "#eccb8a", "#f6e3b4"], scale: 2.2 },
  earth: { kind: "earth" },
  mars: { kind: "rocky", stops: ["#5c1d0a", "#a13d16", "#c96a35", "#e09a62"], craters: 0.35, scale: 2.4, caps: true },
  jupiter: {
    kind: "bands",
    stops: ["#7a5236", "#b98a5e", "#e6cfac", "#f3e7d3", "#c4915f", "#8e6142"],
    freq: 15,
    warp: 0.3,
    spot: { lon: 0.62, lat: 0.62, w: 0.075, h: 0.05, color: "#b5502d" },
  },
  saturn: { kind: "bands", stops: ["#a88a5a", "#d9c08c", "#efe0b8", "#cdb17c", "#b99c6a"], freq: 11, warp: 0.2 },
  uranus: { kind: "bands", stops: ["#7fc1cc", "#9fd8e0", "#b6e6ec", "#94d1da"], freq: 6, warp: 0.25 },
  neptune: {
    kind: "bands",
    stops: ["#22378f", "#3f5fd6", "#5b7de8", "#3550c4"],
    freq: 8,
    warp: 0.3,
    spot: { lon: 0.3, lat: 0.4, w: 0.05, h: 0.03, color: "#1a2a6e" },
  },
  moon: { kind: "rocky", stops: ["#55524f", "#8a8681", "#b4afa9", "#d6d1cb"], craters: 1, scale: 3 },
};

const paint = (style, u, v, p) => {
  const [x, y, z] = p;
  if (style.kind === "sun") {
    const n = fbm(x * 6, y * 6, z * 6, 5);
    const g = fbm(x * 22 + 5, y * 22, z * 22, 3);
    return ramp(style.rgb, n * 0.75 + g * 0.35);
  }
  if (style.kind === "bands") {
    const lat = v;
    const w = fbm(x * 3, y * 3, z * 3, 4) - 0.5;
    const t = 0.5 + 0.5 * Math.sin(lat * style.freq * Math.PI + w * style.warp * 6);
    let c = ramp(style.rgb, t * 0.85 + fbm(x * 9, y * 9, z * 9, 3) * 0.15);
    if (style.spot) {
      const du = (u - style.spot.lon) / style.spot.w;
      const dv = (v - style.spot.lat) / style.spot.h;
      const d = du * du + dv * dv;
      if (d < 1) c = mix(c, style.spotRgb, (1 - d) * 0.85);
    }
    return c;
  }
  if (style.kind === "clouds") {
    const w = fbm(x * 1.5, y * 1.5, z * 1.5, 3);
    const n = fbm(x * style.scale + w * 2, y * style.scale * 2.5, z * style.scale + w * 2, 5);
    return ramp(style.rgb, n);
  }
  if (style.kind === "earth") {
    const lat = Math.abs(v - 0.5) * 2;
    const n = fbm(x * 1.8, y * 1.8, z * 1.8, 6);
    let c;
    if (n < 0.565) {
      c = mix(hex("#0b2a5c"), hex("#1f5fa8"), Math.min(1, Math.max(0, (n - 0.3) / 0.265)));
    } else {
      const dry = fbm(x * 4 + 9, y * 4, z * 4, 3);
      c = mix(hex("#2f6b2a"), hex("#9b7b4c"), Math.min(1, Math.max(0, (dry - 0.45) * 3 + (0.35 - Math.abs(lat - 0.3)) * 1.5)));
      c = mix(c, hex("#d8d2c4"), Math.min(1, Math.max(0, (n - 0.72) * 4)));
    }
    if (lat > 0.82) c = mix(c, hex("#f2f6fa"), Math.min(1, (lat - 0.82) * 12));
    const cloud = fbm(x * 3 + 20, y * 6, z * 3 + 20, 5);
    if (cloud > 0.55) c = mix(c, hex("#ffffff"), Math.min(0.85, (cloud - 0.55) * 3.5));
    return c;
  }
  const n = fbm(x * style.scale, y * style.scale, z * style.scale, 6);
  let c = ramp(style.rgb, n);
  if (style.craters) {
    const cr = fbm(x * 14, y * 14, z * 14, 2);
    if (cr > 0.66) c = mix(c, hex("#2a2826"), Math.min(0.45, (cr - 0.66) * 4) * style.craters);
    if (cr > 0.6 && cr < 0.64) c = mix(c, hex("#e8e4de"), 0.18 * style.craters);
  }
  if (style.caps) {
    const lat = Math.abs(v - 0.5) * 2;
    if (lat > 0.86) c = mix(c, hex("#f3efe9"), Math.min(1, (lat - 0.86) * 14));
  }
  return c;
};

export const TEXTURE_WIDTH = 512;
export const TEXTURE_HEIGHT = 256;

export const renderPlanetPixels = (id) => {
  const base = STYLES[id] ?? STYLES.moon;
  const style = { ...base, rgb: base.stops?.map(hex), spotRgb: base.spot && hex(base.spot.color) };
  const W = TEXTURE_WIDTH;
  const H = TEXTURE_HEIGHT;
  const data = new Uint8ClampedArray(W * H * 4);
  for (let j = 0; j < H; j++) {
    const v = j / (H - 1);
    const theta = v * Math.PI;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    for (let i = 0; i < W; i++) {
      const u = i / W;
      const phi = u * Math.PI * 2;
      const [r, g, b] = paint(style, u, v, [sinT * Math.cos(phi) + 2, cosT + 2, sinT * Math.sin(phi) + 2]);
      const k = (j * W + i) * 4;
      data[k] = r;
      data[k + 1] = g;
      data[k + 2] = b;
      data[k + 3] = 255;
    }
  }
  return data;
};
