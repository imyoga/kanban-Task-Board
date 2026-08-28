import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mode = process.env.NODE_ENV || "development";
const candidatePaths = [
  join(__dirname, `../.env.${mode}`),
  join(__dirname, "../.env"),
];
const envPath = candidatePaths.find((p) => fs.existsSync(p));

// Parse env file if present and process.env is not already populated
if (envPath && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const require = createRequire(join(__dirname, "../apps/api-server/package.json"));
const bcrypt = require("bcryptjs");
const pg = require("pg");

const databaseUrl = process.env.DATABASE_URL || "postgresql://kanban:kanban@127.0.0.1:5432/kanban";
const targetEmail = "moradiyayogeshg@gmail.com";
const targetPassword = "Yogesh123";

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

console.log("Connected to PostgreSQL database:", databaseUrl);

// 1. Ensure session table
await client.query(`
  CREATE TABLE IF NOT EXISTS "session" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
  );
  CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
`);
console.log("✓ Session table verified.");

// 2. Hash password & Upsert user
const passwordHash = await bcrypt.hash(targetPassword, 10);
let userRes = await client.query(
  `SELECT id, email, first_name, last_name FROM users WHERE email = $1`,
  [targetEmail]
);

let userId;
if (userRes.rows.length === 0) {
  const insertUser = await client.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id`,
    [targetEmail, passwordHash, "Yogesh", "Moradiya"]
  );
  userId = insertUser.rows[0].id;
  console.log(`✓ Created user: ${targetEmail} (ID: ${userId})`);
} else {
  userId = userRes.rows[0].id;
  await client.query(
    `UPDATE users SET password_hash = $1, first_name = $2, last_name = $3 WHERE id = $4`,
    [passwordHash, "Yogesh", "Moradiya", userId]
  );
  console.log(`✓ Updated existing user: ${targetEmail} (ID: ${userId}) with new password hash`);
}

// 3. Ensure Board
let boardRes = await client.query(
  `SELECT id, name FROM boards WHERE owner_id = $1 LIMIT 1`,
  [userId]
);

let boardId;
if (boardRes.rows.length === 0) {
  const insertBoard = await client.query(
    `INSERT INTO boards (owner_id, name, created_at)
     VALUES ($1, $2, NOW())
     RETURNING id`,
    [userId, "Product Development"]
  );
  boardId = insertBoard.rows[0].id;
  console.log(`✓ Created board "Product Development" (ID: ${boardId})`);
} else {
  boardId = boardRes.rows[0].id;
  console.log(`✓ Found existing board "${boardRes.rows[0].name}" (ID: ${boardId})`);
}

// 4. Ensure Columns
const defaultColumns = [
  { title: "To Do", color: "#6366f1", position: 0 },
  { title: "In Progress", color: "#f59e0b", position: 1 },
  { title: "Done", color: "#10b981", position: 2 },
];

const columnMap = new Map();
for (const col of defaultColumns) {
  let colRes = await client.query(
    `SELECT id, title FROM columns WHERE board_id = $1 AND title = $2`,
    [boardId, col.title]
  );

  let colId;
  if (colRes.rows.length === 0) {
    const insertCol = await client.query(
      `INSERT INTO columns (board_id, user_id, title, color, position, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      [boardId, userId, col.title, col.color, col.position]
    );
    colId = insertCol.rows[0].id;
    console.log(`✓ Created column "${col.title}" (ID: ${colId})`);
  } else {
    colId = colRes.rows[0].id;
  }
  columnMap.set(col.title, colId);
}

// 5. Clean and Reseed sample tasks with valid priorities ('low' | 'medium' | 'high')
await client.query(`DELETE FROM tasks WHERE board_id = $1`, [boardId]);

const sampleTasks = [
  {
    title: "Design Landing Page & UI components",
    description: "Create sleek, responsive designs for desktop and mobile views.",
    column: "To Do",
    priority: "high",
    position: 0,
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
  },
  {
    title: "Implement Real-time Drag and Drop",
    description: "Smooth drag-and-drop support across Kanban task columns.",
    column: "To Do",
    priority: "low",
    position: 1,
    dueDate: new Date(Date.now() + 86400000 * 5).toISOString().split("T")[0],
  },
  {
    title: "Integrate Authentication Flow",
    description: "Support session authentication, remember me, and secure password hashing.",
    column: "In Progress",
    priority: "high",
    position: 0,
    dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
  },
  {
    title: "Setup Docker & PostgreSQL Environment",
    description: "Configure containerized PostgreSQL and automated migrations.",
    column: "Done",
    priority: "medium",
    position: 0,
    dueDate: new Date().toISOString().split("T")[0],
  },
];

for (const t of sampleTasks) {
  const colId = columnMap.get(t.column);
  await client.query(
    `INSERT INTO tasks (board_id, user_id, title, description, column_id, priority, position, due_date, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
    [boardId, userId, t.title, t.description, colId, t.priority, t.position, t.dueDate]
  );
}
console.log("✓ Reseeded tasks with valid priorities (low, medium, high).");

await client.end();
console.log("\n🎉 Database setup and seeding completed successfully!");
