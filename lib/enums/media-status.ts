import { z } from "zod";

export const MEDIA_STATUSES = [
  "pending",
  "ready",
  "failed",
  "deleted",
] as const;

export type MediaStatus = (typeof MEDIA_STATUSES)[number];

export const mediaStatusSchema = z.enum(MEDIA_STATUSES);
