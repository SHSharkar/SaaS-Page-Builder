import type { ReactNode } from "react";
import { adminHref } from "@/app/lib/admin-path";
import { requireAccountPageCapability } from "@/app/server/auth/guards";
import { getEnv } from "@/app/server/env";
import { WorkspaceShell } from "@/components/app-shell/workspace-shell";
import type { SupportedLocale } from "@/lib/client-catalog";

export const dynamic = "force-dynamic";

function resolveLocale(raw: string): SupportedLocale {
  return raw === "en-US" ? "en-US" : "en-GB";
}

export default async function WorkspaceLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  const actor = await requireAccountPageCapability("workspace.view");
  const env = getEnv();
  const consoleHref =
    actor.platformRole !== "none" ? adminHref("", env.ADMIN_PATH) : undefined;

  return (
    <WorkspaceShell
      accountName={actor.account.name}
      adminHref={consoleHref}
      locale={resolveLocale(actor.account.defaultLocale)}
      roleSlug={actor.accountRole}
    >
      {children}
    </WorkspaceShell>
  );
}
