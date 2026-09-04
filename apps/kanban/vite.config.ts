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
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "task-meta-preview",
        apply: "serve",
        transformIndexHtml: {
          order: "post" as const,
          async handler(html: string, ctx: { originalUrl?: string; req?: { headers?: { host?: string } } }) {
            const url = ctx.originalUrl || "";
            const match = url.match(/^\/boards\/(\d+)\/([^/?#]+)/);
            if (!match) return html;

            const boardId = match[1];
            const taskKey = match[2];
            if (taskKey === "stats") return html;

            try {
              const res = await fetch(
                `http://127.0.0.1:${apiPort}/api/v1/meta/task-preview?boardId=${boardId}&taskKey=${encodeURIComponent(taskKey)}`
              );
              if (!res.ok) return html;
              const meta = (await res.json()) as { title?: string; description?: string };
              if (!meta || !meta.title) return html;

              const host = ctx.req?.headers?.host || `localhost:${frontendPort}`;
              const fullUrl = `http://${host}${url}`;
              const imageUrl = `http://${host}/opengraph.jpg`;

              html = html.replace(/<title>.*?<\/title>/i, `<title>${meta.title}</title>`);

              const setMeta = (attr: string, key: string, content: string) => {
                const pattern = new RegExp(`<meta\\s+[^>]*${attr}=["']${key}["'][^>]*>`, "i");
                const tag = `<meta ${attr}="${key}" content="${content.replace(/"/g, "&quot;")}" />`;
                if (pattern.test(html)) {
                  html = html.replace(pattern, tag);
                } else {
                  html = html.replace("</head>", `  ${tag}\n</head>`);
                }
              };

              setMeta("name", "description", meta.description || "Kanban Task Board");
              setMeta("property", "og:title", meta.title);
              setMeta("property", "og:description", meta.description || "Kanban Task Board");
              setMeta("property", "og:url", fullUrl);
              setMeta("property", "og:site_name", "Kanban Task Board");
              setMeta("property", "og:type", "website");
              setMeta("property", "og:image", imageUrl);
              setMeta("name", "twitter:title", meta.title);
              setMeta("name", "twitter:description", meta.description || "Kanban Task Board");
              setMeta("name", "twitter:image", imageUrl);
              setMeta("name", "twitter:card", "summary_large_image");

              return html;
            } catch {
              return html;
            }
          },
        },
      },
    ],
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
