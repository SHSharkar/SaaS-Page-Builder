import { getTranslations } from "@/app/server/text";
import { Stack, Surface, Text } from "@/components/ui";

export default function FaqPage() {
  const t = getTranslations();
  const items = [
    {
      a: t("marketing.featureRlsBody"),
      q: t("marketing.featureRlsTitle"),
    },
    {
      a: t("marketing.featureDomainsBody"),
      q: t("marketing.featureDomainsTitle"),
    },
    {
      a: t("marketing.featureBlocksBody"),
      q: t("marketing.featureBlocksTitle"),
    },
  ];

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("marketing.faqTitle")}
      </Text>
      <Stack gap="md">
        {items.map((item) => (
          <Surface key={item.q}>
            <Stack gap="sm">
              <Text as="h2" variant="subheading">
                {item.q}
              </Text>
              <Text tone="secondary" variant="body">
                {item.a}
              </Text>
            </Stack>
          </Surface>
        ))}
      </Stack>
    </Stack>
  );
}
