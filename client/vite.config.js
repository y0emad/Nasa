import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const api = "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  define: {
    global: "globalThis",
  },
  server: {
    port: 3000,
    proxy: {
      "/planets/": api,
      "/launches/": api,
      "/solar-system/": api,
    },
  },
  worker: {
    format: "es",
  },
  build: {
    outDir: "../server/public",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
});
