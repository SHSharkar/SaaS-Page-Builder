import { z } from "zod";

export const JOB_KINDS = [
  "page.scheduled-publish",
  "page.scheduled-unpublish",
  "domain.verify",
  "import.process",
  "media.orphan-sweep",
  "backup.snapshot",
  "privacy.erasure",
  "sweeper.daily",
] as const;

export type JobKind = (typeof JOB_KINDS)[number];

export const jobKindSchema = z.enum(JOB_KINDS);
