import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [react(), tailwindcss(),  visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
    })],
  test: {
    globals: true, // Enables global `describe`, `test`, etc.
    environment: "jsdom", // Simulates a browser environment
    setupFiles: "./src/test/setup.ts", // Optional setup file
    include: ["**/*.{test,spec}.{js,ts,jsx,tsx}"], // Custom include pattern
    exclude: ["**/node_modules/**", "**/dist/**"], // Default exclude pattern
  },
  resolve: {
    alias: {
       "@": path.resolve(__dirname, "src"),
    },
  },
});
