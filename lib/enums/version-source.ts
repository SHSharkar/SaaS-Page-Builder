import { z } from "zod";

export const VERSION_SOURCES = [
  "publish",
  "manual",
  "scheduled",
  "rollback",
  "import",
  "template",
] as const;

export type VersionSource = (typeof VERSION_SOURCES)[number];

export const versionSourceSchema = z.enum(VERSION_SOURCES);
