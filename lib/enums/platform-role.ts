import { z } from "zod";

export const PLATFORM_ROLES = [
  "superadmin",
  "support",
  "auditor",
  "none",
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const platformRoleSchema = z.enum(PLATFORM_ROLES);
