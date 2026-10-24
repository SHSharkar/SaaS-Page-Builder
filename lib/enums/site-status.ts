import { z } from "zod";

export const SITE_STATUSES = ["active", "suspended", "deleted"] as const;

export type SiteStatus = (typeof SITE_STATUSES)[number];

export const siteStatusSchema = z.enum(SITE_STATUSES);
