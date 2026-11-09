import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const FONTS = ['400 16px "Titillium Web"', '400 16px "Source Code Pro"', '24px "Material Icons"'];

const sheetLoaded = (link) =>
  link.sheet ? Promise.resolve() : new Promise((resolve) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
  });

const fontsReady = () => {
  if (!document.fonts) return Promise.resolve();
  const sheets = [...document.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis"]')];
  return Promise.all(sheets.map(sheetLoaded)).then(() => Promise.all(FONTS.map((font) => document.fonts.load(font))));
};

const render = () => createRoot(document.getElementById("root")).render(<App />);

Promise.race([fontsReady(), new Promise((resolve) => setTimeout(resolve, 1200))])
  .catch(() => undefined)
  .finally(render);
