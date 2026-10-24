import { z } from "zod";

export const DOMAIN_STATUSES = [
  "pending",
  "verifying",
  "active",
  "failed",
  "removed",
] as const;

export type DomainStatus = (typeof DOMAIN_STATUSES)[number];

export const domainStatusSchema = z.enum(DOMAIN_STATUSES);
