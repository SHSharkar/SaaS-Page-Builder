import { AppLink, Badge, Stack, Surface, Text } from "@/components/ui";
import type { BlockNode, PageDocument } from "@/lib/documents";
import { getBlockSpec } from "@/lib/registry";

export interface DocumentRendererProps {
  readonly document: PageDocument;
  readonly footerDocument?: PageDocument | null;
  readonly navDocument?: PageDocument | null;
}

function readStringProp(
  props: Record<string, unknown>,
  key: string,
  fallback = "",
): string {
  const raw = props[key];
  return typeof raw === "string" ? raw : fallback;
}

function renderBlock(block: BlockNode) {
  const spec = getBlockSpec(block.type);
  const heading =
    readStringProp(block.props, "headline") ||
    readStringProp(block.props, "heading") ||
    (spec?.name ?? block.type);
  const subheading =
    readStringProp(block.props, "subheadline") ||
    readStringProp(block.props, "subheading");
  const body = readStringProp(block.props, "body");
  const ctaLabel = readStringProp(block.props, "ctaLabel");
  const ctaHref = readStringProp(block.props, "ctaHref", "/");

  return (
    <Surface className="w-full" key={block.id} tone="card">
      <Stack gap="sm">
        <Badge>{spec?.group ?? block.type}</Badge>
        {heading ? (
          <Text as="h2" variant="heading">
            {heading}
          </Text>
        ) : null}
        {subheading ? (
          <Text tone="secondary" variant="subheading">
            {subheading}
          </Text>
        ) : null}
        {body ? <Text variant="body">{body}</Text> : null}
        {ctaLabel ? (
          <AppLink href={ctaHref} variant="button">
            {ctaLabel}
          </AppLink>
        ) : null}
      </Stack>
    </Surface>
  );
}

export function DocumentRenderer({
  document,
  footerDocument,
  navDocument,
}: DocumentRendererProps) {
  return (
    <Stack gap="lg">
      {navDocument && navDocument.content.length > 0 ? (
        <Stack gap="sm">{navDocument.content.map(renderBlock)}</Stack>
      ) : null}
      <Stack gap="md">{document.content.map(renderBlock)}</Stack>
      {footerDocument && footerDocument.content.length > 0 ? (
        <Stack gap="sm">{footerDocument.content.map(renderBlock)}</Stack>
      ) : null}
    </Stack>
  );
}
