import {
  ACCOUNT_ROLE_CAPABILITIES,
  PLATFORM_ROLE_CAPABILITIES,
} from "../app/server/capabilities";
import { ACCOUNT_ROLES, PLATFORM_ROLES } from "../lib/enums";
import {
  type CheckResult,
  failCheck,
  passCheck,
  runCliCheck,
} from "./lib/check";

export function verifyRoles(): CheckResult {
  const failures: string[] = [];
  const accountMapKeys = Object.keys(ACCOUNT_ROLE_CAPABILITIES).sort();
  const expectedAccount = [...ACCOUNT_ROLES].sort();
  if (JSON.stringify(accountMapKeys) !== JSON.stringify(expectedAccount)) {
    failures.push(
      `ACCOUNT_ROLE_CAPABILITIES keys (${accountMapKeys.join(",")}) != ACCOUNT_ROLES (${expectedAccount.join(",")})`,
    );
  }

  const platformMapKeys = Object.keys(PLATFORM_ROLE_CAPABILITIES).sort();
  const expectedPlatform = [...PLATFORM_ROLES].sort();
  if (JSON.stringify(platformMapKeys) !== JSON.stringify(expectedPlatform)) {
    failures.push(
      `PLATFORM_ROLE_CAPABILITIES keys (${platformMapKeys.join(",")}) != PLATFORM_ROLES (${expectedPlatform.join(",")})`,
    );
  }

  return failures.length === 0
    ? passCheck(
        "verify:roles",
        "Account and platform role enums match capability matrices 1-to-1",
      )
    : failCheck("verify:roles", "Role definition mismatch", failures);
}

void runCliCheck(import.meta.url, () => verifyRoles());
