import { z } from "zod";

export const MEDIA_REF_SOURCES = [
  "page_draft",
  "page_version",
  "site_content",
  "site_theme",
  "page_seo",
] as const;

export type MediaRefSource = (typeof MEDIA_REF_SOURCES)[number];

export const mediaRefSourceSchema = z.enum(MEDIA_REF_SOURCES);
