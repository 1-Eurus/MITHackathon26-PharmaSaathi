import { defineConfig } from "vite";

// Dev-only proxy so the frontend can call same-origin `/api/...` while the
// invoice-intake backend (server/index.ts, SQLite-persisted) runs on its
// own port - no CORS handling needed. `npm run build` produces a plain
// static site with no backend; the invoice-scan feature's persistence needs
// `npm run dev` (or an equivalent proxy in front of server/index.ts in a
// real deployment) - extraction itself (OCR + parsing) still works without
// it, just without cross-session history.
export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
