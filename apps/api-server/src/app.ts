import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import router from "./routes";
import { logger } from "./lib/logger";
import { getTaskPreviewMeta, getBoardPreviewMeta, injectHtmlMeta } from "./lib/metaPreview";

const PgSession = ConnectPgSimple(session);
const isProduction = process.env.NODE_ENV === "production";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, "../../kanban/dist/public");

const app: Express = express();

if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: "session",
    }),
    secret: process.env.SESSION_SECRET ?? "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: "auto",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: "lax",
    },
  }),
);

app.use("/api", router);

app.use(express.static(frontendDist));
app.use(async (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/ws")) return next();
  const distIndex = path.join(frontendDist, "index.html");
  const srcIndex = path.resolve(__dirname, "../../kanban/index.html");
  const indexPath = fs.existsSync(distIndex) ? distIndex : fs.existsSync(srcIndex) ? srcIndex : null;

  if (!indexPath) return next();

  // Check if this matches a task or board URL
  const taskMatch = req.path.match(/^\/boards\/(\d+)\/([^/]+)\/?$/);
  const boardMatch = !taskMatch && req.path.match(/^\/boards\/(\d+)\/?$/);

  if (taskMatch || boardMatch) {
    try {
      let html = await fs.promises.readFile(indexPath, "utf-8");
      const host = req.get("host") || "localhost";
      const protocol = req.protocol || "http";
      const baseUrl = `${protocol}://${host}`;
      const fullUrl = `${baseUrl}${req.originalUrl}`;
      const imageUrl = `${baseUrl}/opengraph.jpg`;

      if (taskMatch) {
        const boardId = parseInt(taskMatch[1], 10);
        const taskKey = decodeURIComponent(taskMatch[2]);
        if (taskKey !== "stats") {
          const meta = await getTaskPreviewMeta(boardId, taskKey);
          if (meta) {
            html = injectHtmlMeta(html, {
              ...meta,
              url: fullUrl,
              image: imageUrl,
              siteName: "Kanban Task Board",
            });
            res.status(200).type("html").send(html);
            return;
          }
        }
      } else if (boardMatch) {
        const boardId = parseInt(boardMatch[1], 10);
        const meta = await getBoardPreviewMeta(boardId);
        if (meta) {
          html = injectHtmlMeta(html, {
            ...meta,
            url: fullUrl,
            image: imageUrl,
            siteName: "Kanban Task Board",
          });
          res.status(200).type("html").send(html);
          return;
        }
      }
    } catch (err) {
      logger.error({ err }, "Failed to render dynamic page preview meta");
    }
  }

  res.sendFile(indexPath);
});

export default app;
