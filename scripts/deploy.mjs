import { execSync } from "node:child_process";

const SSH_TARGET = process.env.DEPLOY_SSH_TARGET || "99.251.24.209-sejal";
const REMOTE_APP_DIR = "C:\\Users\\yoges\\Desktop\\Development\\app13-45013-kanban-Task-Board";
const SERVICE_NAME = "app13-45013-kanban-task-board";
const LIVE_URL = "https://kanban-task-board.ym-apps.live/";

const isLocal =
  process.cwd().toLowerCase() === REMOTE_APP_DIR.toLowerCase() ||
  process.env.DEPLOY_LOCAL === "true";

function runLocal(cmd) {
  console.log(`\n> [LOCAL] ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

function runRemote(remoteCmd) {
  if (isLocal) {
    runLocal(remoteCmd);
    return;
  }
  console.log(`\n> [REMOTE] ${remoteCmd}`);
  const sshCmd = `ssh ${SSH_TARGET} "cd ${REMOTE_APP_DIR} ; ${remoteCmd}"`;
  execSync(sshCmd, { stdio: "inherit" });
}

async function verifyHealth() {
  console.log(`\n> Polling ${LIVE_URL} for 200 OK status...`);
  const maxAttempts = 30;
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await fetch(LIVE_URL);
      if (res.status === 200) {
        console.log(`\n🎉 Live deployment verified! ${LIVE_URL} returned 200 OK.`);
        return true;
      }
      console.log(`Attempt ${i}/${maxAttempts}: Received HTTP ${res.status}, waiting...`);
    } catch {
      console.log(`Attempt ${i}/${maxAttempts}: Server initializing, waiting...`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Deployment health check timed out for ${LIVE_URL}`);
}

async function main() {
  console.log("==================================================");
  console.log(`🚀 Starting Automated Deployment (${isLocal ? "Local Host" : "Remote SSH"})`);
  console.log(`• Target:          ${isLocal ? "Local Machine" : SSH_TARGET}`);
  console.log(`• Path:            ${REMOTE_APP_DIR}`);
  console.log(`• Service Name:    ${SERVICE_NAME}`);
  console.log("==================================================");

  // 1. Push local changes to GitHub
  runLocal("git push origin main");

  // 2. Pull latest code if remote, or ensure up-to-date
  if (!isLocal) {
    runRemote("git pull origin main");
  }

  // 3. Sync dependencies
  runRemote("pnpm install");

  // 4. Apply database migrations
  runRemote("pnpm db:push");

  // 5. Restart NSSM Windows Service (triggers build & server start)
  runRemote(`powershell -Command "Restart-Service ${SERVICE_NAME}"`);

  // 6. Verify health
  await verifyHealth();
}

main().catch((err) => {
  console.error("\n❌ Deployment failed:", err.message);
  process.exit(1);
});
