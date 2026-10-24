"use client";

import { AppLink, Button, Stack, Surface, Text } from "@/components/ui";
import { useTranslations } from "@/hooks/use-translations";
import { extractErrorDigest } from "@/lib/error-digest";

export interface ErrorPanelProps {
  readonly digest?: string;
  readonly homeHref?: string;
  readonly onReset?: () => void;
}

export function ErrorPanel({
  digest,
  homeHref = "/",
  onReset,
}: ErrorPanelProps) {
  const t = useTranslations();
  const safeDigest = extractErrorDigest({ digest }) ?? "ERR-UNTRACKED";

  return (
    <Surface className="mx-auto my-12 max-w-xl">
      <Stack gap="md">
        <Text as="h1" variant="heading">
          {t("feedback.errorTitle")}
        </Text>
        <Text tone="secondary" variant="body">
          {t("feedback.errorDescription")}
        </Text>
        <Text tone="secondary" variant="caption">
          {`${t("feedback.referenceLabel")}: ${safeDigest}`}
        </Text>
        <Stack direction="row" gap="sm">
          {onReset ? (
            <Button onClick={onReset} variant="primary">
              {t("common.retry")}
            </Button>
          ) : null}
          <AppLink href={homeHref} variant="nav">
            {t("nav.home")}
          </AppLink>
        </Stack>
      </Stack>
    </Surface>
  );
}
