import { z } from "zod";

export const JOB_KINDS = [
  "page.scheduled-publish",
  "page.scheduled-unpublish",
  "domain.verify",
  "media.orphan-sweep",
  "privacy.erasure",
  "sweeper.daily",
] as const;

export type JobKind = (typeof JOB_KINDS)[number];

export const jobKindSchema = z.enum(JOB_KINDS);
