import "server-only";
import pino from "pino";

export const REDACTED_PATHS = [
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "contact",
  "phone",
  "email",
  "ciphertext",
  "*.password",
  "*.token",
  "*.secret",
  "*.contact",
  "*.phone",
] as const;

export function createAppLogger(level = process.env.LOG_LEVEL ?? "silent") {
  return pino({
    level,
    redact: {
      paths: [...REDACTED_PATHS],
      censor: "[REDACTED]",
    },
    base: {
      service: "saas-page-builder",
    },
  });
}

export const logger = createAppLogger(
  process.env.NODE_ENV === "test"
    ? "silent"
    : (process.env.LOG_LEVEL ?? "info"),
);
