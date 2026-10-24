import { getTranslations } from "@/app/server/text";
import { AppLink, Badge, Stack, Surface, Text } from "@/components/ui";
import { formatMinorMoney } from "@/lib/money";
import { PUBLIC_PATHS } from "@/lib/paths";

export default function PricingPage() {
  const t = getTranslations();
  const tiers = [
    {
      amountMinor: 0,
      code: "starter",
      domains: "1",
      name: "Starter",
      sites: "2",
    },
    {
      amountMinor: 3900,
      code: "growth",
      domains: "10",
      name: "Growth",
      sites: "15",
    },
    {
      amountMinor: 12900,
      code: "scale",
      domains: "50",
      name: "Scale",
      sites: "100",
    },
  ];

  return (
    <Stack gap="lg">
      <Stack gap="sm">
        <Text as="h1" variant="display">
          {t("marketing.pricingTitle")}
        </Text>
        <Text tone="secondary" variant="body">
          {t("marketing.pricingSubtitle")}
        </Text>
      </Stack>
      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((tier) => {
          const priceLabel = formatMinorMoney(tier.amountMinor, "GBP", "en-GB");
          const limitsLabel = `${tier.sites} ${t("nav.sites")} / ${tier.domains} ${t("nav.domains")}`;
          return (
            <Surface key={tier.code}>
              <Stack gap="md">
                <Badge tone="accent">{tier.name}</Badge>
                <Text as="h2" variant="heading">
                  {priceLabel}
                </Text>
                <Text tone="secondary" variant="body">
                  {limitsLabel}
                </Text>
                <AppLink href={PUBLIC_PATHS.signUp} variant="button">
                  {t("marketing.ctaPrimary")}
                </AppLink>
              </Stack>
            </Surface>
          );
        })}
      </div>
    </Stack>
  );
}
