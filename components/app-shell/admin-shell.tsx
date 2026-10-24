import type { ReactNode } from "react";
import { AppLink, Badge, Stack, Text } from "@/components/ui";
import {
  createCatalogTranslator,
  type SupportedLocale,
} from "@/lib/client-catalog";
import { APP_PATHS, PUBLIC_PATHS } from "@/lib/paths";
import { RealtimeListener } from "./realtime-listener";

export interface AdminNavTab {
  readonly href: string;
  readonly label: string;
}

export interface AdminShellProps {
  readonly children: ReactNode;
  readonly locale?: SupportedLocale;
  readonly platformRole: string;
  readonly tabs: readonly AdminNavTab[];
}

export function AdminShell({
  children,
  locale,
  platformRole,
  tabs,
}: AdminShellProps) {
  const t = createCatalogTranslator(locale);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <RealtimeListener endpoint="/api/realtime/platform" />
      <header className="border-b border-border-subtle bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Stack align="center" direction="row" gap="sm">
            <Text as="span" variant="subheading">
              {t("admin.consoleTitle")}
            </Text>
            <Badge tone="accent">{platformRole}</Badge>
          </Stack>
          <Stack direction="row" gap="sm">
            <AppLink href={APP_PATHS.dashboard} variant="nav">
              {t("nav.dashboard")}
            </AppLink>
            <AppLink href={PUBLIC_PATHS.signedOut} variant="nav">
              {t("nav.signOut")}
            </AppLink>
          </Stack>
        </div>
        <nav className="mx-auto flex max-w-7xl flex-wrap gap-1 px-6 pb-3">
          {tabs.map((tab) => (
            <AppLink href={tab.href} key={tab.href} variant="nav">
              {tab.label}
            </AppLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
