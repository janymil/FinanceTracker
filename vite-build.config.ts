import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'exclude-lucide-react',
      resolveId(id) {
        if (id === 'lucide-react') {
          // Redirect lucide-react imports to our centralized registry
          return path.resolve(import.meta.dirname, "client/src/lib/icons-registry.tsx");
        }
        return null;
      }
    }
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      "lucide-react": path.resolve(import.meta.dirname, "client/src/lib/icons-registry.tsx"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  optimizeDeps: {
    exclude: ['lucide-react']
  }
});