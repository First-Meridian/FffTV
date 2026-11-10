import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env.local")) {
  console.log(".env.local already exists; left unchanged.");
} else {
  writeFileSync(
    ".env.local",
    `ADMIN_USERNAME=admin\nADMIN_PASSWORD=${randomBytes(18).toString("base64url")}\nDATABASE_PATH=./data/ffftv.sqlite\nAPP_ORIGIN=http://127.0.0.1:3000\nCOOKIE_SECURE=false\n`,
    { mode: 0o600 },
  );
  console.log(
    "Created .env.local with a random administrator password. Open this local file to read your credentials.",
  );
}
