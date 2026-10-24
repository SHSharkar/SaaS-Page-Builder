export type VerifyTier = "fast" | "code" | "schema" | "full";

export const VERIFY_TIERS: readonly VerifyTier[] = [
  "fast",
  "code",
  "schema",
  "full",
];

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

export function isVerifyTier(value: string): value is VerifyTier {
  return (VERIFY_TIERS as readonly string[]).includes(value);
}

export function requestedTier(
  env: Readonly<Record<string, string | undefined>> = process.env,
): VerifyTier | null {
  const raw = env.VERIFY_TIER?.trim().toLowerCase();
  return raw && isVerifyTier(raw) ? raw : null;
}

export function classifyVerifyTier(
  changedFiles: readonly string[],
  trigger = process.env.VERIFY_TRIGGER ?? "pre-push",
  forced: VerifyTier | null = requestedTier(),
): VerifyTier {
  if (forced) {
    return forced;
  }
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
