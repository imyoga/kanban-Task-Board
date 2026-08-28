import pg from "../lib/db/node_modules/pg/lib/index.js";
import dotenv from "../artifacts/api-server/node_modules/dotenv/lib/main.js";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const result = await client.query(
  `UPDATE boards
   SET name = $1
   WHERE id = 10
     AND owner_id = (SELECT id FROM users WHERE lower(email) = lower($2))
   RETURNING id, name, owner_id`,
  ["Satsang Page", "yogeshc@smk-usa.org"],
);

console.log(result.rows[0] ? `Renamed board to: ${result.rows[0].name}` : "Board not found");
await client.end();
