"use client";

import { useCallback } from "react";
import {
  formatCatalogMessage,
  type SupportedLocale,
} from "@/lib/client-catalog";

export function useTranslations(locale: SupportedLocale = "en-GB") {
  return useCallback(
    (key: string, values?: Record<string, string | number>) =>
      formatCatalogMessage(key, values, locale),
    [locale],
  );
}
