import "server-only";
import {
  formatCatalogMessage,
  type SupportedLocale,
} from "@/lib/client-catalog";

export function getTranslations(locale: SupportedLocale = "en-GB") {
  return (key: string, values?: Record<string, string | number>): string =>
    formatCatalogMessage(key, values, locale);
}
