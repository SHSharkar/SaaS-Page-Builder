import { z } from "zod";

export const IMPORT_STATUSES = [
  "uploaded",
  "parsing",
  "mapped",
  "in_review",
  "applied",
  "failed",
  "discarded",
] as const;

export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const importStatusSchema = z.enum(IMPORT_STATUSES);
