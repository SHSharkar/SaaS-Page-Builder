import { Layers } from "lucide-react";
import type { ReactNode } from "react";
import { AppLink, Badge, Stack, Surface, Text } from "@/components/ui";
import {
  createCatalogTranslator,
  type SupportedLocale,
} from "@/lib/client-catalog";
import { APP_PATHS, PUBLIC_PATHS } from "@/lib/paths";
import { RealtimeListener } from "./realtime-listener";

export interface WorkspaceShellProps {
  readonly accountName: string;
  readonly adminHref?: string;
  readonly children: ReactNode;
  readonly locale?: SupportedLocale;
  readonly roleSlug: string;
}

export function WorkspaceShell({
  accountName,
  adminHref,
  children,
  locale,
  roleSlug,
}: WorkspaceShellProps) {
  const t = createCatalogTranslator(locale);
  const navItems = [
    { href: APP_PATHS.dashboard, label: t("nav.dashboard") },
    { href: APP_PATHS.sites, label: t("nav.sites") },
    { href: APP_PATHS.templates, label: t("nav.templates") },
    { href: APP_PATHS.domains, label: t("nav.domains") },
    { href: APP_PATHS.media, label: t("nav.media") },
    { href: APP_PATHS.imports, label: t("nav.imports") },
    { href: APP_PATHS.analytics, label: t("nav.analytics") },
    { href: APP_PATHS.team, label: t("nav.team") },
    { href: APP_PATHS.exportData, label: t("nav.export") },
    { href: APP_PATHS.settings, label: t("nav.settings") },
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <RealtimeListener endpoint="/api/realtime" />
      <header className="border-b border-border-subtle bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Stack align="center" direction="row" gap="sm">
            <Layers aria-hidden="true" className="h-4 w-4 text-subtle" />
            <AppLink href={APP_PATHS.dashboard} variant="nav">
              <Text as="span" variant="subheading">
                SaaS Page Builder
              </Text>
            </AppLink>
            <Badge tone="accent">{accountName}</Badge>
            <Badge>{roleSlug}</Badge>
          </Stack>
          <nav className="flex flex-wrap items-center gap-1">
            {navItems.map((item) => (
              <AppLink href={item.href} key={item.href} variant="nav">
                {item.label}
              </AppLink>
            ))}
            {adminHref ? (
              <AppLink href={adminHref} variant="nav">
                {t("nav.admin")}
              </AppLink>
            ) : null}
            <AppLink href={PUBLIC_PATHS.signedOut} variant="nav">
              {t("nav.signOut")}
            </AppLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Surface bordered={false} className="bg-transparent p-0" padded={false}>
          {children}
        </Surface>
      </main>
    </div>
  );
}
