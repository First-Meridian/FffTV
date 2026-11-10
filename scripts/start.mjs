import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
const root = process.cwd();
if (!existsSync(".next/standalone/server.js"))
  throw new Error("Run npm run build before npm start.");
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
const server = spawn(
  process.execPath,
  [resolve(".next/standalone/server.js")],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: process.env.HOSTNAME || "127.0.0.1",
      PORT: process.env.PORT || "3000",
      DATABASE_PATH: resolve(
        process.env.DATABASE_PATH || "./data/ffftv.sqlite",
      ),
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 0));
