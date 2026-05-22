import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: "::",
    port: 5179,
    strictPort: false,
    allowedHosts: [
      "luxmac-mini",
      "luxmac-mini.tail3aaf3f.ts.net",
      ".tail3aaf3f.ts.net",
    ],
  },
  preview: {
    host: "::",
    port: 4189,
    allowedHosts: [
      "luxmac-mini",
      "luxmac-mini.tail3aaf3f.ts.net",
      ".tail3aaf3f.ts.net",
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
