import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const nginxDir = "C:/Users/yoges/Desktop/Development/app0-00000-nginx-1.26.0";
const confFile = path.join(nginxDir, "conf/nginx.conf");

if (!fs.existsSync(confFile)) {
  console.log(`Nginx conf not found at ${confFile}, skipping update.`);
  process.exit(0);
}

let content = fs.readFileSync(confFile, "utf8");

if (!content.includes("proxy_buffering      off;") && !content.includes("proxy_buffering off;")) {
  const targetStr = "server_name  kanban-task-board.ym-apps.live;";
  if (content.includes(targetStr)) {
    content = content.replace(
      targetStr,
      `${targetStr}\n        proxy_buffering off;\n        proxy_cache off;`
    );
    fs.readFileSync(confFile); // verify readable
    fs.writeFileSync(confFile, content, "utf8");
    console.log("✓ Updated Nginx config with proxy_buffering off for SSE.");

    try {
      execSync(`"${nginxDir}/nginx.exe" -t`, { cwd: nginxDir, stdio: "inherit" });
      execSync(`"${nginxDir}/nginx.exe" -s reload`, { cwd: nginxDir, stdio: "inherit" });
      console.log("✓ Tested & reloaded Nginx successfully.");
    } catch (e) {
      console.error("Failed to test/reload Nginx:", e);
    }
  } else {
    console.log("Target server_name kanban-task-board.ym-apps.live not found in nginx.conf");
  }
} else {
  console.log("✓ Nginx config already has proxy_buffering disabled for SSE.");
  try {
    execSync(`"${nginxDir}/nginx.exe" -t`, { cwd: nginxDir, stdio: "inherit" });
    execSync(`"${nginxDir}/nginx.exe" -s reload`, { cwd: nginxDir, stdio: "inherit" });
    console.log("✓ Reloaded Nginx successfully.");
  } catch (e) {
    console.error("Nginx reload notice:", e.message);
  }
}
