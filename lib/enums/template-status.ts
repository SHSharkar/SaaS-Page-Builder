import { z } from "zod";

export const TEMPLATE_STATUSES = ["active", "retired"] as const;

export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export const templateStatusSchema = z.enum(TEMPLATE_STATUSES);
