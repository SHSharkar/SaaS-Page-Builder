import { z } from "zod";

export const ACCOUNT_ROLES = ["owner", "admin", "editor", "viewer"] as const;

export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const accountRoleSchema = z.enum(ACCOUNT_ROLES);
