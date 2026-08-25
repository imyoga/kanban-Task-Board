import { spawnSync } from "child_process";
import fs from "node:fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

export function ensureSchema() {
  const serverDist = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(serverDist, "../../..");
  const pushScript = join(repoRoot, "lib/db/scripts/push.mjs");
  const envFile = join(repoRoot, ".env");

  if (!fs.existsSync(pushScript)) {
    throw new Error(`Schema push script not found at ${pushScript}`);
  }

  if (!process.env.DATABASE_URL && !fs.existsSync(envFile)) {
    throw new Error("DATABASE_URL is not set and no .env file was found");
  }

  const nodeArgs = fs.existsSync(envFile) ? [`--env-file=${envFile}`] : [];

  const result = spawnSync(process.execPath, [...nodeArgs, pushScript], {
    cwd: repoRoot,
    env: { ...process.env, CI: "true" },
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error("Database schema sync failed");
  }
}
