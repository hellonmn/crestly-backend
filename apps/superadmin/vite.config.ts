import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const workspaceRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@crestly/shared": path.resolve(workspaceRoot, "packages/shared/src/index.ts"),
      "@crestly/icons": path.resolve(workspaceRoot, "packages/icons/src/index.tsx"),
      "@crestly/design": path.resolve(workspaceRoot, "packages/design/src/index.ts"),
    },
  },
  server: {
    port: 5174,
    fs: { allow: [workspaceRoot] },
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
  optimizeDeps: {
    exclude: ["@crestly/shared", "@crestly/icons", "@crestly/design"],
  },
});
