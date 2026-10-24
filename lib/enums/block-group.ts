import { z } from "zod";

export const BLOCK_GROUPS = [
  "site-frame",
  "conversion",
  "money",
  "content",
  "utility",
] as const;

export type BlockGroup = (typeof BLOCK_GROUPS)[number];

export const blockGroupSchema = z.enum(BLOCK_GROUPS);
