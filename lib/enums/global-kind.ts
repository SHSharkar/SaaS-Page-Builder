import { z } from "zod";

export const GLOBAL_KINDS = ["navigation", "footer", "defaults"] as const;

export type GlobalKind = (typeof GLOBAL_KINDS)[number];

export const globalKindSchema = z.enum(GLOBAL_KINDS);
