import { z } from "zod";

export const CERTIFICATE_STATES = [
  "none",
  "pending",
  "issued",
  "failed",
] as const;

export type CertificateState = (typeof CERTIFICATE_STATES)[number];

export const certificateStateSchema = z.enum(CERTIFICATE_STATES);
