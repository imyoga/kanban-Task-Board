import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const port = 45014;
const child = spawn(
  process.execPath,
  [
    "--import",
    "./apps/api-server/load-env.mjs",
    "--enable-source-maps",
    "./apps/api-server/dist/index.mjs",
  ],
  {
    env: { ...process.env, NODE_ENV: "development", PORT: String(port), API_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let started = false;
child.stdout.on("data", (d) => {
  const text = d.toString();
  process.stdout.write(text);
  if (text.includes("Server listening")) started = true;
});
child.stderr.on("data", (d) => process.stderr.write(d));

for (let i = 0; i < 30 && !started; i++) await sleep(500);

const base = `http://localhost:${port}`;
const loginRes = await fetch(`${base}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    email: "moradiyayogeshg@gmail.com",
    password: "Yogesh123",
  }),
});

console.log("login", loginRes.status, await loginRes.text());
const cookie = loginRes.headers.getSetCookie?.().map((c) => c.split(";")[0]).join("; ") ?? "";
console.log("cookie", cookie);

const teamsRes = await fetch(`${base}/api/teams`, {
  headers: { Cookie: cookie },
  credentials: "include",
});
console.log("teams", teamsRes.status, await teamsRes.text());

child.kill();
