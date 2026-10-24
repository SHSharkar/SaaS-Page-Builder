import { adminHref } from "@/app/lib/admin-path";
import type { AdminNavTab } from "@/components/app-shell/admin-shell";
import type { PlatformRole } from "@/lib/enums";

export interface AdminTabInput {
  readonly adminPath: string;
  readonly platformRole: PlatformRole;
  readonly t: (key: string) => string;
}

export function buildAdminTabs(input: AdminTabInput): AdminNavTab[] {
  const { adminPath, platformRole, t } = input;
  const base: AdminNavTab[] = [
    { href: adminHref("", adminPath), label: t("admin.overviewHeading") },
    {
      href: adminHref("accounts", adminPath),
      label: t("admin.accountsHeading"),
    },
    { href: adminHref("sites", adminPath), label: t("admin.sitesHeading") },
    {
      href: adminHref("domains", adminPath),
      label: t("admin.domainsHeading"),
    },
    {
      href: adminHref("templates", adminPath),
      label: t("admin.templatesHeading"),
    },
    {
      href: adminHref("components", adminPath),
      label: t("admin.componentsHeading"),
    },
    { href: adminHref("users", adminPath), label: t("admin.usersHeading") },
    { href: adminHref("roles", adminPath), label: t("admin.rolesHeading") },
    {
      href: adminHref("imports", adminPath),
      label: t("admin.importsHeading"),
    },
    { href: adminHref("media", adminPath), label: t("admin.mediaHeading") },
    {
      href: adminHref("short-links", adminPath),
      label: t("admin.shortLinksHeading"),
    },
    { href: adminHref("audit", adminPath), label: t("admin.auditHeading") },
    {
      href: adminHref("operations", adminPath),
      label: t("admin.operationsHeading"),
    },
    {
      href: adminHref("backups", adminPath),
      label: t("admin.backupsHeading"),
    },
    {
      href: adminHref("settings", adminPath),
      label: t("admin.settingsHeading"),
    },
  ];
  if (platformRole === "superadmin") {
    base.push({
      href: adminHref("privacy", adminPath),
      label: t("admin.privacyHeading"),
    });
  }
  return base;
}
