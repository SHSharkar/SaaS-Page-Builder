import { createDecipheriv } from "node:crypto";
import fs from "node:fs";
import { getEnv } from "../app/server/env";
import { isMainModule } from "./lib/check";
import { log } from "./lib/log";

export function decryptBackupEnvelope(
  envelope: string,
  hexKey: string,
): string {
  const [prefix, ivB64, tagB64, bodyB64] = envelope.trim().split(":");
  if (prefix !== "bak1" || !ivB64 || !tagB64 || bodyB64 === undefined) {
    throw new Error("Invalid backup envelope header");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(hexKey, "hex"),
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(bodyB64, "base64url")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}

if (isMainModule(import.meta.url)) {
  const inputPath = process.argv[2];
  if (!inputPath) {
    log.failed("Usage: bun scripts/decrypt-backup.ts <encrypted-file>");
    process.exit(1);
  }
  const raw = fs.readFileSync(inputPath, "utf8");
  process.stdout.write(
    decryptBackupEnvelope(raw, getEnv().BACKUP_ENCRYPTION_KEY),
  );
}
