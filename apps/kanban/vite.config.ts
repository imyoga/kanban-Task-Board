import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { execSync } from "child_process";

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(import.meta.dirname, "../..");
  const env = loadEnv(mode, envDir, "");
  const frontendPort = Number(env.FE_PORT ?? 5173);
  const apiPort = Number(env.PORT ?? 5000);
  const basePath = env.BASE_PATH ?? "/";

  let commitHash = "dev";
  try {
    commitHash = execSync("git rev-parse --short HEAD", { cwd: import.meta.dirname }).toString().trim();
  } catch {
    // fallback if git command fails
  }

  if (Number.isNaN(frontendPort) || frontendPort <= 0) {
    throw new Error(`Invalid FE_PORT value: "${env.FE_PORT}"`);
  }

  if (Number.isNaN(apiPort) || apiPort <= 0) {
    throw new Error(`Invalid PORT value: "${env.PORT}"`);
  }

  return {
    base: basePath,
    envDir,
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __COMMIT_HASH__: JSON.stringify(commitHash),
    },
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
        "/ws": {
          target: `http://127.0.0.1:${apiPort}`,
          ws: true,
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
