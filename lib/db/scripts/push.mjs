import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const dbRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const drizzleBin = join(dbRoot, "node_modules/drizzle-kit/bin.cjs");
const envFile = join(dbRoot, "../../.env");

const result = spawnSync(
  process.execPath,
  [
    `--env-file=${envFile}`,
    drizzleBin,
    "push",
    "--force",
    "--config",
    "./drizzle.config.ts",
  ],
  {
    cwd: dbRoot,
    stdio: "inherit",
    env: { ...process.env, CI: "true" },
  },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
