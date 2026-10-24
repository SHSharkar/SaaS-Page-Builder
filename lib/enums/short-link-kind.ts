import { z } from "zod";

export const SHORT_LINK_KINDS = [
  "invitation",
  "preview",
  "export",
  "password_reset",
  "my_data",
] as const;

export type ShortLinkKind = (typeof SHORT_LINK_KINDS)[number];

export const shortLinkKindSchema = z.enum(SHORT_LINK_KINDS);
