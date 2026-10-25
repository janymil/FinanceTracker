import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

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
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  // Client-side debug chatter is dead weight in a production bundle and can print
  // financial details into the browser console. console.warn/error stay.
  esbuild: {
    pure:
      process.env.NODE_ENV === "production"
        ? ["console.log", "console.info", "console.debug"]
        : [],
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // The entry used to carry every vendor library (2.2 MB). Splitting node_modules into
    // stable groups keeps the app entry small and lets browsers cache the vendors across
    // deploys, because a code change no longer invalidates the library bundle.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          const pkg = (name: string) => id.includes(`/node_modules/${name}/`);
          if (pkg("react-dom") || pkg("react") || pkg("scheduler")) return "react";
          if (pkg("@clerk")) return "clerk";
          if (pkg("@radix-ui")) return "radix";
          if (pkg("recharts") || pkg("chart.js") || pkg("d3-")) return "charts";
          if (pkg("@react-pdf") || pkg("pdf-lib") || pkg("jspdf")) return "pdf";
          if (pkg("xlsx")) return "xlsx";
          if (pkg("tesseract.js")) return "ocr";
          if (pkg("framer-motion")) return "motion";
          if (pkg("@tanstack")) return "query";
          if (pkg("date-fns")) return "date-fns";
          if (pkg("lucide-react") || pkg("react-icons")) return "icons";
          if (pkg("i18next") || pkg("react-i18next")) return "i18n";
          if (pkg("html2canvas")) return "html2canvas";
          return "vendor";
        },
      },
    },
  },
});
