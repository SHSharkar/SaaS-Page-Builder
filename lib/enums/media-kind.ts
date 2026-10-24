import { z } from "zod";

export const MEDIA_KINDS = ["image", "document", "import_reference"] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];

export const mediaKindSchema = z.enum(MEDIA_KINDS);
