const media = (query) => typeof window !== "undefined" && window.matchMedia?.(query).matches;

export const prefersReducedMotion = () => Boolean(media("(prefers-reduced-motion: reduce)"));

export const isLowPower = () => {
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency || 8;
  const memory = navigator.deviceMemory || 8;
  const phone = media("(max-width: 760px)") || media("(pointer: coarse)");
  return cores <= 4 || memory <= 4 || (phone && cores <= 6);
};

export const graphicsProfile = () => {
  const low = isLowPower();
  const reducedMotion = prefersReducedMotion();
  return {
    low,
    reducedMotion,
    dpr: low ? [1, 1.25] : [1, 1.75],
    particles: low ? 0.5 : 1,
    stars: low ? 0.4 : 1,
    antialias: !low,
  };
};
