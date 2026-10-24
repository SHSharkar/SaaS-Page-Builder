import { z } from "zod";

export const DOMAIN_KINDS = ["platform_subdomain", "custom"] as const;

export type DomainKind = (typeof DOMAIN_KINDS)[number];

export const domainKindSchema = z.enum(DOMAIN_KINDS);
