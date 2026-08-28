import fs from "node:fs";
import { execSync } from "node:child_process";

const nginxConf = "C:/Users/yoges/Desktop/Development/app0-00000-nginx-1.26.0/conf/nginx.conf";

if (!fs.existsSync(nginxConf)) {
  console.log("Nginx configuration file not found at", nginxConf);
  process.exit(1);
}

let content = fs.readFileSync(nginxConf, "utf8");

const serverBlockRegex = /# Kanban Task Board -> port 45013[\s\S]*?server\s*\{[\s\S]*?server_name\s+kanban-task-board\.ym-apps\.live;[\s\S]*?\n    \}/;

const newServerBlock = `# Kanban Task Board -> port 45013 (backend serves frontend dist + API)
    server {
        listen       443 ssl;
        server_name  kanban-task-board.ym-apps.live;

        ssl_certificate      certs/ym-apps.live-chain.pem;
        ssl_certificate_key  certs/ym-apps.live-key.pem;
        ssl_session_cache    shared:SSL:1m;
        ssl_session_timeout  5m;
        ssl_ciphers  HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers  on;

        location / {
            proxy_pass         http://127.0.0.1:45013;
            proxy_http_version 1.1;
            proxy_set_header   Connection "";
            proxy_set_header   Host $host;
            proxy_set_header   X-Real-IP $remote_addr;
            proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto $scheme;
            proxy_read_timeout 86400s;
            proxy_send_timeout 86400s;
            proxy_buffering    off;
            proxy_cache        off;
            chunked_transfer_encoding off;
        }

        error_page   500 502 503 504  /50x.html;
        location = /50x.html {
            root   html;
        }
    }`;

if (serverBlockRegex.test(content)) {
  content = content.replace(serverBlockRegex, newServerBlock);
  fs.writeFileSync(nginxConf, content, "utf8");
  console.log("✓ Updated Kanban server block in nginx.conf for SSE streaming.");
} else {
  console.log("Could not find matching Kanban server block to replace.");
}
