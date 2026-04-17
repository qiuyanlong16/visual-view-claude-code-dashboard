import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5173,
    proxy: {
      "/events": "http://localhost:3456",
      "/sessions": "http://localhost:3456",
      "/memory": "http://localhost:3456",
      "/stats": "http://localhost:3456",
      "/health": "http://localhost:3456",
      "/setup": "http://localhost:3456",
    },
  },
});
