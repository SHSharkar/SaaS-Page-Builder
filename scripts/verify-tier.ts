export type VerifyTier = "fast" | "code" | "schema" | "full";

const SCHEMA_TRIGGERS = [
  "drizzle/",
  "drizzle.config.ts",
  "app/server/db/",
  "scripts/migrate.ts",
];

const FULL_TRIGGERS = [
  "package.json",
  "bun.lock",
  "Dockerfile",
  "Dockerfile.worker",
  "docker-compose.yml",
  "next.config.ts",
  "eslint.config.mjs",
  ".husky/",
];

export function classifyVerifyTier(
  changedFiles: readonly string[],
  trigger = process.env.VERIFY_TRIGGER ?? "pre-push",
): VerifyTier {
  if (trigger === "manual" || changedFiles.length === 0) {
    return "full";
  }
  if (
    changedFiles.some((file) =>
      FULL_TRIGGERS.some(
        (prefix) => file === prefix || file.startsWith(prefix),
      ),
    )
  ) {
    return "full";
  }
  if (
    changedFiles.some((file) =>
      SCHEMA_TRIGGERS.some(
        (prefix) => file === prefix || file.startsWith(prefix),
      ),
    )
  ) {
    return "schema";
  }
  const onlyDocs = changedFiles.every(
    (file) => file.endsWith(".md") && !file.startsWith(".specify/"),
  );
  return onlyDocs ? "fast" : "code";
}
