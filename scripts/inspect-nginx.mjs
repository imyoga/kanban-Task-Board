import fs from "node:fs";

const file = "C:/Users/yoges/Desktop/Development/app0-00000-nginx-1.26.0/conf/nginx.conf";
if (fs.existsSync(file)) {
  const content = fs.readFileSync(file, "utf8");
  const idx = content.indexOf("kanban-task-board.ym-apps.live");
  if (idx !== -1) {
    console.log("=== KANBAN NGINX BLOCK ===");
    console.log(content.slice(idx - 100, idx + 600));
  } else {
    console.log("kanban-task-board.ym-apps.live not found in nginx.conf");
  }
} else {
  console.log("Nginx file not found");
}
