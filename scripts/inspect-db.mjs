import pg from "../packages/db/node_modules/pg/lib/index.js";
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, "../apps/api-server/package.json"));
const bcrypt = require("bcryptjs");

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL || "postgresql://kanban:kanban@127.0.0.1:5432/kanban" });
await client.connect();

console.log("=== Tables in database ===");
const tables = await client.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
);
console.log(tables.rows.map((r) => r.table_name).join(", "));

console.log("\n=== Users ===");
const users = await client.query("SELECT id, email, first_name, last_name, password_hash FROM users");
for (const u of users.rows) {
  const isMatch = await bcrypt.compare("Yogesh123", u.password_hash);
  console.log(`User ID: ${u.id}, Email: ${u.email}, Name: ${u.first_name} ${u.last_name}, Password matches 'Yogesh123': ${isMatch}`);
}

console.log("\n=== Boards ===");
const boards = await client.query(`
  SELECT b.id, b.name, b.owner_id, u.email as owner_email, count(t.id) as task_count
  FROM boards b
  LEFT JOIN users u ON b.owner_id = u.id
  LEFT JOIN tasks t ON b.id = t.board_id
  GROUP BY b.id, b.name, b.owner_id, u.email
`);
console.table(boards.rows);

console.log("\n=== Columns & Tasks ===");
const tasks = await client.query(`
  SELECT c.title as column, t.title as task_title, t.priority, t.due_date
  FROM columns c
  LEFT JOIN tasks t ON c.id = t.column_id
  ORDER BY c.position, t.position
`);
console.table(tasks.rows);

await client.end();
