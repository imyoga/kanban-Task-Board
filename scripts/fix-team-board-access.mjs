import pg from "../packages/db/node_modules/pg/lib/index.js";
import dotenv from "../apps/api-server/node_modules/dotenv/lib/main.js";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const OWNER_EMAIL = "yogeshc@smk-usa.org";

async function inspect() {
  const ownerRes = await client.query(
    "SELECT id, email, first_name, last_name FROM users WHERE lower(email) = lower($1)",
    [OWNER_EMAIL],
  );
  console.log("Owner:", ownerRes.rows);
  const ownerId = ownerRes.rows[0]?.id;
  if (!ownerId) return null;

  const teams = await client.query("SELECT * FROM teams WHERE owner_id = $1", [ownerId]);
  console.log("Teams:", teams.rows);

  for (const team of teams.rows) {
    const members = await client.query(
      `SELECT tm.user_id, u.email, u.first_name, u.last_name
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1
       ORDER BY u.email`,
      [team.id],
    );
    console.log(`Team ${team.id} (${team.name}) members:`, members.rows);

    const invites = await client.query(
      "SELECT id, email, created_at FROM team_invites WHERE team_id = $1 ORDER BY email",
      [team.id],
    );
    console.log(`Team ${team.id} pending invites:`, invites.rows);

    if (team.board_id) {
      const board = await client.query("SELECT * FROM boards WHERE id = $1", [team.board_id]);
      console.log(`Team ${team.id} linked board:`, board.rows);

      const boardMembers = await client.query(
        `SELECT bm.user_id, u.email
         FROM board_members bm
         JOIN users u ON u.id = bm.user_id
         WHERE bm.board_id = $1`,
        [team.board_id],
      );
      console.log(`Board ${team.board_id} board_members:`, boardMembers.rows);
    } else {
      console.log(`Team ${team.id} has NO linked board`);
    }
  }

  const boards = await client.query("SELECT * FROM boards WHERE owner_id = $1", [ownerId]);
  console.log("Owner boards:", boards.rows);

  return { ownerId, teams: teams.rows };
}

const mode = process.argv[2] ?? "inspect";
const data = await inspect();

if (mode === "fix" && data) {
  const team =
    data.teams.find((t) => t.name.toLowerCase().includes("satsang")) ?? data.teams[0];
  if (!team) {
    console.error("No team found to fix");
    process.exit(1);
  }

  let boardId = team.board_id;
  if (!boardId) {
    const boardRes = await client.query(
      "SELECT id, name FROM boards WHERE owner_id = $1 ORDER BY id",
      [data.ownerId],
    );
    const myBoard = boardRes.rows.find((b) => b.name === "My Board") ?? boardRes.rows[0];
    if (!myBoard) {
      console.error("No board found for owner");
      process.exit(1);
    }
    boardId = myBoard.id;
    await client.query("UPDATE teams SET board_id = $1 WHERE id = $2", [boardId, team.id]);
    console.log(`Linked team ${team.id} to board ${boardId} (${myBoard.name})`);
  }

  const members = await client.query(
    "SELECT user_id FROM team_members WHERE team_id = $1",
    [team.id],
  );
  const memberIds = new Set(members.rows.map((r) => r.user_id));
  memberIds.add(data.ownerId);

  for (const userId of memberIds) {
    await client.query(
      `INSERT INTO board_members (board_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [boardId, userId],
    );
    const user = await client.query("SELECT email FROM users WHERE id = $1", [userId]);
    console.log(`Ensured board_members for ${user.rows[0]?.email}`);
  }

  const invites = await client.query(
    "SELECT email FROM team_invites WHERE team_id = $1",
    [team.id],
  );
  for (const invite of invites.rows) {
    const userRes = await client.query(
      "SELECT id, email FROM users WHERE lower(email) = lower($1)",
      [invite.email],
    );
    if (userRes.rows[0]) {
      const userId = userRes.rows[0].id;
      await client.query(
        `INSERT INTO team_members (team_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [team.id, userId],
      );
      await client.query(
        `INSERT INTO board_members (board_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [boardId, userId],
      );
      await client.query("DELETE FROM team_invites WHERE team_id = $1 AND lower(email) = lower($2)", [
        team.id,
        invite.email,
      ]);
      console.log(`Accepted invite for existing user ${userRes.rows[0].email}`);
    }
  }

  console.log("\nAfter fix:");
  await inspect();
}

await client.end();
