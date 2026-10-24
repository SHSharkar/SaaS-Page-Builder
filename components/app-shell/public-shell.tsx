import type { ReactNode } from "react";
import { AppLink, Stack, Text } from "@/components/ui";
import {
  createCatalogTranslator,
  type SupportedLocale,
} from "@/lib/client-catalog";
import { PUBLIC_PATHS } from "@/lib/paths";

export interface PublicShellProps {
  readonly children: ReactNode;
  readonly locale?: SupportedLocale;
}

export function PublicShell({ children, locale }: PublicShellProps) {
  const t = createCatalogTranslator(locale);

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="border-b border-border-subtle bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <AppLink href={PUBLIC_PATHS.home} variant="nav">
            <Text as="span" variant="subheading">
              SaaS Page Builder
            </Text>
          </AppLink>
          <nav className="flex flex-wrap items-center gap-2">
            <AppLink href={PUBLIC_PATHS.features} variant="nav">
              {t("nav.features")}
            </AppLink>
            <AppLink href={PUBLIC_PATHS.pricing} variant="nav">
              {t("nav.pricing")}
            </AppLink>
            <AppLink href={PUBLIC_PATHS.faq} variant="nav">
              {t("nav.faq")}
            </AppLink>
            <AppLink href={PUBLIC_PATHS.myData} variant="nav">
              {t("nav.myData")}
            </AppLink>
            <AppLink href={PUBLIC_PATHS.signIn} variant="nav">
              {t("nav.signIn")}
            </AppLink>
            <AppLink href={PUBLIC_PATHS.signUp} variant="button">
              {t("nav.signUp")}
            </AppLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        {children}
      </main>
      <footer className="border-t border-border-subtle bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6">
          <Text tone="secondary" variant="caption">
            {t("brand.tagline")}
          </Text>
          <Stack direction="row" gap="sm">
            <AppLink href={PUBLIC_PATHS.privacy} variant="inline">
              {t("nav.privacy")}
            </AppLink>
            <AppLink href={PUBLIC_PATHS.terms} variant="inline">
              {t("nav.terms")}
            </AppLink>
            <AppLink href={PUBLIC_PATHS.myData} variant="inline">
              {t("nav.myData")}
            </AppLink>
          </Stack>
        </div>
      </footer>
    </div>
  );
}
