import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import { existsSync } from "fs";

const dbRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const drizzleBin = join(dbRoot, "node_modules/drizzle-kit/bin.cjs");
const mode = process.env.NODE_ENV || "development";
const candidateEnvs = [
  join(dbRoot, `../../.env.${mode}`),
  join(dbRoot, "../../.env"),
];
const envFile = candidateEnvs.find((f) => existsSync(f)) || candidateEnvs[candidateEnvs.length - 1];

// Non-interactive stdin: auto-accept default choices (create, not rename) for any prompts.
const nonInteractiveInput = "\n".repeat(50);

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
    input: nonInteractiveInput,
    stdio: ["pipe", "inherit", "inherit"],
    env: { ...process.env, CI: "true" },
  },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
