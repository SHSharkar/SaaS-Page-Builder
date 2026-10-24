import { z } from "zod";

export const TEMPLATE_SCOPES = ["platform", "account"] as const;

export type TemplateScope = (typeof TEMPLATE_SCOPES)[number];

export const templateScopeSchema = z.enum(TEMPLATE_SCOPES);
