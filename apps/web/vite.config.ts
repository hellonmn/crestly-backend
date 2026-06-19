import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

const workspaceRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,                   // we register manually in pwa-register.ts
      strategies: "generateSW",
      // We ship the manifest in /public so we don't double-emit it. Tell the
      // plugin to skip its own manifest emission.
      manifest: false,
      workbox: {
        // App shell + design + icons.
        globPatterns: [
          "**/*.{js,css,html,svg,png,ico,woff2}",
        ],
        // Don't cache the API; we never want stale data.
        navigateFallback: "/offline.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/@/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "crestly-images",
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "script" || request.destination === "style",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "crestly-assets" },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-files",
              expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Disabled to keep dev fast; uncomment to test SW locally.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@crestly/shared": path.resolve(workspaceRoot, "packages/shared/src/index.ts"),
      "@crestly/icons": path.resolve(workspaceRoot, "packages/icons/src/index.tsx"),
      "@crestly/design": path.resolve(workspaceRoot, "packages/design/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    fs: { allow: [workspaceRoot] },
    proxy: {
      "/api":     { target: "http://localhost:4000", changeOrigin: true, ...withCleanRetry() },
      // Selfies + voucher attachments + brand uploads are served by the API
      // under /uploads. In production they live on the same origin; in dev
      // we need this proxy so <img src="/uploads/..."> resolves correctly.
      "/uploads": { target: "http://localhost:4000", changeOrigin: true, ...withCleanRetry() },
    },
  },
  optimizeDeps: {
    exclude: ["@crestly/shared", "@crestly/icons", "@crestly/design"],
  },
});

/**
 * Proxy-error noise reducer.
 *
 * During `npm run dev`, the API takes ~30-60s to compile + boot. The web
 * vite is up immediately and starts proxying queries, each of which throws
 * a 14-line AggregateError stack trace ([ECONNREFUSED]) into the console.
 * With React Query retrying 3× per call across ~5 startup queries, that's
 * a 200-line wall of red on every restart.
 *
 * This wrapper:
 *   - rate-limits the "API not ready" log to once per 5 seconds
 *   - sends the client a clean JSON 503 so axios fails fast (no stack)
 */
function withCleanRetry() {
  let lastLogAt = 0;
  return {
    configure: (proxy: { on: (e: string, h: (...a: never[]) => void) => void }) => {
      proxy.on("error", (err: NodeJS.ErrnoException, _req: unknown, res: { writableEnded?: boolean; writeHead: (s: number, h: Record<string, string>) => void; end: (b: string) => void }) => {
        const now = Date.now();
        if (now - lastLogAt > 5000) {
          // eslint-disable-next-line no-console
          console.log(`[vite proxy] api server not ready yet (${err.code ?? "error"}) — will retry`);
          lastLogAt = now;
        }
        if (!res.writableEnded) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "api_starting", message: "API server still booting. Refresh in a moment." }));
        }
      });
    },
  };
}
