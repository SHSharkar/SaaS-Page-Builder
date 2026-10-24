import "server-only";
import type { AccountRole, PlatformRole } from "@/lib/enums";

export const ACCOUNT_CAPABILITIES = [
  "workspace.view",
  "sites.view",
  "sites.manage",
  "pages.view",
  "pages.edit",
  "pages.publish",
  "globals.manage",
  "domains.view",
  "domains.manage",
  "media.view",
  "media.manage",
  "imports.manage",
  "templates.view",
  "templates.manage",
  "analytics.view",
  "team.view",
  "team.manage",
  "export.request",
  "settings.manage",
  "catalog.admin_blocks",
] as const;

export type AccountCapability = (typeof ACCOUNT_CAPABILITIES)[number];

export const PLATFORM_CAPABILITIES = [
  "platform.console.view",
  "platform.accounts.manage",
  "platform.sites.manage",
  "platform.domains.manage",
  "platform.templates.manage",
  "platform.users.manage",
  "platform.roles.manage",
  "platform.settings.manage",
  "platform.operations.manage",
  "platform.backups.manage",
  "platform.privacy.reveal",
  "platform.audit.view",
] as const;

export type PlatformCapability = (typeof PLATFORM_CAPABILITIES)[number];

export const ACCOUNT_ROLE_CAPABILITIES: Readonly<
  Record<AccountRole, readonly AccountCapability[]>
> = {
  owner: ACCOUNT_CAPABILITIES,
  admin: ACCOUNT_CAPABILITIES,
  editor: [
    "workspace.view",
    "sites.view",
    "sites.manage",
    "pages.view",
    "pages.edit",
    "pages.publish",
    "globals.manage",
    "domains.view",
    "media.view",
    "media.manage",
    "imports.manage",
    "templates.view",
    "templates.manage",
    "analytics.view",
  ],
  viewer: [
    "workspace.view",
    "sites.view",
    "pages.view",
    "domains.view",
    "media.view",
    "templates.view",
    "analytics.view",
    "team.view",
  ],
};

export const PLATFORM_ROLE_CAPABILITIES: Readonly<
  Record<PlatformRole, readonly PlatformCapability[]>
> = {
  superadmin: PLATFORM_CAPABILITIES,
  support: [
    "platform.console.view",
    "platform.accounts.manage",
    "platform.sites.manage",
    "platform.domains.manage",
    "platform.templates.manage",
    "platform.audit.view",
  ],
  auditor: ["platform.console.view", "platform.audit.view"],
  none: [],
};

export function accountRoleHasCapability(
  role: AccountRole,
  capability: AccountCapability,
): boolean {
  return ACCOUNT_ROLE_CAPABILITIES[role].includes(capability);
}

export function platformRoleHasCapability(
  role: PlatformRole,
  capability: PlatformCapability,
): boolean {
  return PLATFORM_ROLE_CAPABILITIES[role].includes(capability);
}
