import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const frontendPort = 5173;

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(import.meta.dirname, "../..");
  const env = loadEnv(mode, envDir, "");
  const apiPort = Number(env.PORT ?? 5000);
  const basePath = env.BASE_PATH ?? "/";

  if (Number.isNaN(apiPort) || apiPort <= 0) {
    throw new Error(`Invalid PORT value: "${env.PORT}"`);
  }

  return {
    base: basePath,
    envDir,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port: frontendPort,
      strictPort: true,
      host: "0.0.0.0",
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: frontendPort,
      host: "0.0.0.0",
    },
  };
});
