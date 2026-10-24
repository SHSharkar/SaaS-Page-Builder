import { z } from "zod";

export const ACCOUNT_STATUSES = [
  "active",
  "suspended",
  "pending_deletion",
  "deleted",
] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const accountStatusSchema = z.enum(ACCOUNT_STATUSES);
