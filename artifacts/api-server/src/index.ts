import app from "./app";
import { logger } from "./lib/logger";
import { seedIfNeeded } from "./lib/seed";

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 5000);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT ?? process.env.API_PORT}"`);
}

seedIfNeeded().catch((err) => {
  logger.error({ err }, "Seed failed");
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
