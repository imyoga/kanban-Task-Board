import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
const mode = process.env.NODE_ENV || "development";
const envFiles = [`.env.${mode}`, `.env.${mode}.local`, `.env.local`, `.env`].filter(Boolean);
const dirs = [path.resolve(here, "../../"), process.cwd(), path.resolve(process.cwd(), "../../")];

let loaded = false;
for (const file of envFiles) {
  for (const dir of dirs) {
    const envPath = path.resolve(dir, file);
    if (existsSync(envPath)) {
      dotenv.config({ path: envPath });
      loaded = true;
      break;
    }
  }
  if (loaded) break;
}

