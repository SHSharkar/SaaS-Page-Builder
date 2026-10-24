import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { bootstrapEnv } from "../app/server/bootstrap-env";
import { log } from "./lib/log";

bootstrapEnv();

const rootDir = process.cwd();
const standaloneDir = path.join(rootDir, ".next", "standalone");
const standaloneServer = path.join(standaloneDir, "server.js");

if (fs.existsSync(standaloneServer)) {
  const staticSrc = path.join(rootDir, ".next", "static");
  const staticDest = path.join(standaloneDir, ".next", "static");
  if (fs.existsSync(staticSrc) && !fs.existsSync(staticDest)) {
    fs.mkdirSync(path.dirname(staticDest), { recursive: true });
    fs.cpSync(staticSrc, staticDest, { recursive: true });
  }
  const publicSrc = path.join(rootDir, "public");
  const publicDest = path.join(standaloneDir, "public");
  if (fs.existsSync(publicSrc) && !fs.existsSync(publicDest)) {
    fs.cpSync(publicSrc, publicDest, { recursive: true });
  }
}

const args = fs.existsSync(standaloneServer)
  ? [standaloneServer]
  : ["--bun", "next", "start", "-H", process.env.HOSTNAME ?? "0.0.0.0"];

log.info(`Starting SaaS Page Builder server (${args.join(" ")})`);

const child = spawn("bun", args, {
  stdio: "inherit",
  env: {
    ...process.env,
    HOSTNAME: process.env.HOSTNAME ?? "0.0.0.0",
    PORT: process.env.PORT ?? "3000",
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
