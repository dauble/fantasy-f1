// vite.config.js
// Updated to proxy /api requests to the Express server during local development.
// In production (Fly.io), Express serves both the app and /api on the same origin.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // During dev: forward /api calls to the Express proxy server
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
