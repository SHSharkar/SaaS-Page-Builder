import { requirePlatformPageCapability } from "@/app/server/auth/guards";
import type { PlatformCapability } from "@/app/server/capabilities";

export async function requireAdminConsoleSession(
  capability: PlatformCapability = "platform.console.view",
) {
  return requirePlatformPageCapability(capability);
}
