import { z } from "zod";

export const PAGE_STATUSES = [
  "draft",
  "published",
  "archived",
  "deleted",
] as const;

export type PageStatus = (typeof PAGE_STATUSES)[number];

export const pageStatusSchema = z.enum(PAGE_STATUSES);
