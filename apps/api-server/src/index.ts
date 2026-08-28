import http from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { seedIfNeeded } from "./lib/seed";
import { setupWebSocketServer } from "./lib/boardEvents";

const port = Number(process.env.PORT ?? 5000);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

try {
  await seedIfNeeded();
} catch (err) {
  logger.error({ err }, "Startup seed failed");
  process.exit(1);
}

const server = http.createServer(app);

setupWebSocketServer(server);

server.listen(port, () => {
  logger.info({ port }, "Server listening with WebSocket on /ws");
});
