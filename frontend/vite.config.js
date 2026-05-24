// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,       // auto-opens browser on npm run dev
    host: true,       // exposes local network link (e.g. 192.168.x.x:3000)
  },
  build: {
    outDir: "dist",
  },
});
