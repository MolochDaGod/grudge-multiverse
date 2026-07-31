import { resolve } from "path";
import { defineConfig } from "vite";

/**
 * Multiverse SPA — multiplayer-gltf as production entry.
 * Live: multiverse.grudge-studio.com (also metaverse alias optional)
 */
export default defineConfig({
  base: "/",
  root: resolve(__dirname),
  publicDir: "public",
  server: { host: true, port: 5195 },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
    },
  },
  resolve: {
    alias: {
      // LocalPlayer historically imported ../../../src/playerController
      three: "three",
    },
  },
});
