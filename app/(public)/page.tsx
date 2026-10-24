import { getTranslations } from "@/app/server/text";
import { AppLink, Badge, Stack, Surface, Text } from "@/components/ui";
import { PUBLIC_PATHS } from "@/lib/paths";
import { BLOCK_CATALOG } from "@/lib/registry";

export default function MarketingHomePage() {
  const t = getTranslations();
  const blockCountLabel = `${BLOCK_CATALOG.length}+`;

  return (
    <Stack gap="lg">
      <Surface className="p-10" tone="card">
        <Stack gap="md">
          <Badge tone="accent">{blockCountLabel}</Badge>
          <Text as="h1" variant="display">
            {t("marketing.heroTitle")}
          </Text>
          <Text tone="secondary" variant="body">
            {t("marketing.heroSubtitle")}
          </Text>
          <Stack direction="row" gap="sm">
            <AppLink href={PUBLIC_PATHS.signUp} variant="button">
              {t("marketing.ctaPrimary")}
            </AppLink>
            <AppLink href={PUBLIC_PATHS.pricing} variant="nav">
              {t("marketing.ctaSecondary")}
            </AppLink>
          </Stack>
        </Stack>
      </Surface>

      <div className="grid gap-6 md:grid-cols-3">
        <Surface>
          <Stack gap="sm">
            <Text as="h2" variant="subheading">
              {t("marketing.featureBlocksTitle")}
            </Text>
            <Text tone="secondary" variant="body">
              {t("marketing.featureBlocksBody")}
            </Text>
          </Stack>
        </Surface>
        <Surface>
          <Stack gap="sm">
            <Text as="h2" variant="subheading">
              {t("marketing.featureDomainsTitle")}
            </Text>
            <Text tone="secondary" variant="body">
              {t("marketing.featureDomainsBody")}
            </Text>
          </Stack>
        </Surface>
        <Surface>
          <Stack gap="sm">
            <Text as="h2" variant="subheading">
              {t("marketing.featureRlsTitle")}
            </Text>
            <Text tone="secondary" variant="body">
              {t("marketing.featureRlsBody")}
            </Text>
          </Stack>
        </Surface>
      </div>
    </Stack>
  );
}
