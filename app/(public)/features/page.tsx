import { getTranslations } from "@/app/server/text";
import { Badge, Stack, Surface, Text } from "@/components/ui";
import { BLOCK_CATALOG } from "@/lib/registry";

export default function FeaturesPage() {
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Stack gap="sm">
        <Text as="h1" variant="display">
          {t("marketing.featuresTitle")}
        </Text>
        <Text tone="secondary" variant="body">
          {t("marketing.heroSubtitle")}
        </Text>
      </Stack>
      <div className="grid gap-4 md:grid-cols-3">
        {BLOCK_CATALOG.slice(0, 12).map((block) => (
          <Surface key={block.alias}>
            <Stack gap="sm">
              <Badge tone="accent">{block.group}</Badge>
              <Text as="h2" variant="subheading">
                {block.name}
              </Text>
              <Text tone="secondary" variant="caption">
                {block.description}
              </Text>
            </Stack>
          </Surface>
        ))}
      </div>
    </Stack>
  );
}
