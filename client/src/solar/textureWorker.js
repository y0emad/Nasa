import { renderPlanetPixels } from "./planetPixels";

self.onmessage = ({ data: id }) => {
  const pixels = renderPlanetPixels(id);
  self.postMessage({ id, pixels }, [pixels.buffer]);
};
