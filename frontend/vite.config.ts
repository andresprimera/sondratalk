import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 5174,
    allowedHosts: [".ngrok-free.app"],
    proxy: {
      "/api": {
        target: "http://localhost:3030",
        changeOrigin: true,
      },
      // socket.io (real-time call ring) — forward the WS handshake + upgrade
      // to the backend so the client can connect to the dev server origin.
      "/socket.io": {
        target: "http://localhost:3030",
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
