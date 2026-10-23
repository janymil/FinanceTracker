import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { sentryVitePlugin } from "@sentry/vite-plugin";

/**
 * Source-map upload only runs when all three Sentry build vars are present. Without them
 * the build is byte-for-byte the previous behaviour: no plugin, no .map files on disk.
 */
const sentryUploadEnabled = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
);

export default defineConfig({
  envDir: path.resolve(import.meta.dirname),
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
    // Uploads source maps so production stack traces point at real files and lines
    // instead of `index-abc123.js:1:48213`. Skipped entirely without SENTRY_AUTH_TOKEN.
    ...(sentryUploadEnabled
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            telemetry: false,
            release: {
              name: process.env.SENTRY_RELEASE || process.env.VITE_SENTRY_RELEASE,
              inject: true,
            },
            sourcemaps: {
              assets: [path.resolve(import.meta.dirname, "dist", "public", "**")],
              filesToDeleteAfterUpload: [
                path.resolve(import.meta.dirname, "dist", "public", "**", "*.map"),
              ],
            },
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Hidden maps are generated only when they will be uploaded, then deleted by the
    // plugin. Without a token nothing changes and no .map file is ever written.
    ...(sentryUploadEnabled ? { sourcemap: "hidden" as const } : {}),
  },
});
