import { randomBytes } from "node:crypto";
import { isMainModule } from "./lib/check";

export function generateEnvKeyBlock(): string {
  const hexKey = () => randomBytes(32).toString("hex");
  const lines = [
    `BETTER_AUTH_SECRET=${randomBytes(32).toString("base64url")}`,
    `SETTINGS_ENCRYPTION_KEY=${hexKey()}`,
    `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=${hexKey()}`,
    `GUEST_LOOKUP_KEY=${hexKey()}`,
    `GUEST_CONTACT_KEY=${hexKey()}`,
    `BACKUP_ENCRYPTION_KEY=${hexKey()}`,
    `INTERNAL_TLS_CHECK_TOKEN=${randomBytes(24).toString("base64url")}`,
  ];
  return `${lines.join("\n")}\n`;
}

if (isMainModule(import.meta.url)) {
  process.stdout.write(generateEnvKeyBlock());
}
