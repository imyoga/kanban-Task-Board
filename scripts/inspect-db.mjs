import pg from "../lib/db/node_modules/pg/lib/index.js";

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const tables = await client.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
);
console.log("tables:", tables.rows.map((r) => r.table_name));

for (const name of ["teams", "session", "team_members", "team_invites"]) {
  const cols = await client.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position",
    [name],
  );
  console.log(name + " columns:", cols.rows);
}

await client.end();
