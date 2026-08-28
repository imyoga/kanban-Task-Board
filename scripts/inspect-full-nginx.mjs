import fs from "node:fs";

const file = "C:/Users/yoges/Desktop/Development/app0-00000-nginx-1.26.0/conf/nginx.conf";
if (fs.existsSync(file)) {
  const content = fs.readFileSync(file, "utf8");
  const idx = content.lastIndexOf("server_name  kanban-task-board.ym-apps.live;");
  if (idx !== -1) {
    const endIdx = content.indexOf("server {", idx);
    console.log("=== FULL KANBAN SERVER BLOCK ===");
    console.log(content.slice(idx - 150, endIdx !== -1 ? endIdx : idx + 1000));
  }
}
