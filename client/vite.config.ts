import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  server: {
    allowedHosts: [
      "cultural-swinger-march.ngrok-free.dev",
    ],

    proxy: {
      "/rooms": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/movies": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:5000",
        ws: true,
        changeOrigin: true,
      },
      "/auth": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});