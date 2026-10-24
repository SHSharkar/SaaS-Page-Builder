import {
  ACCOUNT_CAPABILITIES,
  ACCOUNT_ROLE_CAPABILITIES,
  PLATFORM_CAPABILITIES,
  PLATFORM_ROLE_CAPABILITIES,
} from "../app/server/capabilities";
import {
  type CheckResult,
  failCheck,
  passCheck,
  runCliCheck,
} from "./lib/check";

export function verifyCapabilities(): CheckResult {
  const failures: string[] = [];

  const assignedAccount = new Set(
    Object.values(ACCOUNT_ROLE_CAPABILITIES).flat(),
  );
  for (const cap of ACCOUNT_CAPABILITIES) {
    if (!assignedAccount.has(cap)) {
      failures.push(`Account capability "${cap}" is not assigned to any role`);
    }
    if (!ACCOUNT_ROLE_CAPABILITIES.owner.includes(cap)) {
      failures.push(`Account owner role is missing capability "${cap}"`);
    }
  }

  const assignedPlatform = new Set(
    Object.values(PLATFORM_ROLE_CAPABILITIES).flat(),
  );
  for (const cap of PLATFORM_CAPABILITIES) {
    if (!assignedPlatform.has(cap)) {
      failures.push(`Platform capability "${cap}" is not assigned to any role`);
    }
    if (!PLATFORM_ROLE_CAPABILITIES.superadmin.includes(cap)) {
      failures.push(`Platform superadmin role is missing capability "${cap}"`);
    }
  }

  if (PLATFORM_ROLE_CAPABILITIES.none.length > 0) {
    failures.push('Platform role "none" must not grant any capabilities');
  }

  return failures.length === 0
    ? passCheck(
        "verify:capabilities",
        `Verified ${ACCOUNT_CAPABILITIES.length} account capabilities and ${PLATFORM_CAPABILITIES.length} platform capabilities`,
      )
    : failCheck(
        "verify:capabilities",
        "Capability matrix invariant failed",
        failures,
      );
}

void runCliCheck(import.meta.url, () => verifyCapabilities());
