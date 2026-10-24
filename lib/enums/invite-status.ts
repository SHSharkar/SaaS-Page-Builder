import { z } from "zod";

export const INVITE_STATUSES = [
  "pending",
  "accepted",
  "revoked",
  "expired",
] as const;

export type InviteStatus = (typeof INVITE_STATUSES)[number];

export const inviteStatusSchema = z.enum(INVITE_STATUSES);
