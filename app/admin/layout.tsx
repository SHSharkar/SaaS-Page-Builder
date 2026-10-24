import type { ReactNode } from "react";
import { getEnv } from "@/app/server/env";
import { getTranslations } from "@/app/server/text";
import { AdminShell } from "@/components/app-shell/admin-shell";
import { requireAdminConsoleSession } from "./admin-session";
import { buildAdminTabs } from "./admin-tabs";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  const ctx = await requireAdminConsoleSession("platform.console.view");
  const env = getEnv();
  const t = getTranslations();
  const tabs = buildAdminTabs({
    adminPath: env.ADMIN_PATH,
    platformRole: ctx.platformRole,
    t,
  });

  return (
    <AdminShell platformRole={ctx.platformRole} tabs={tabs}>
      {children}
    </AdminShell>
  );
}
