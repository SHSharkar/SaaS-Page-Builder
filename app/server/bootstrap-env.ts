import "server-only";
import { getEnv } from "./env";

let verified = false;

export function bootstrapEnv(): void {
  if (verified) {
    return;
  }
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }
  getEnv();
  verified = true;
}

export function resetBootstrapState(): void {
  verified = false;
}
