import enGb from "@/messages/en-GB.json";
import enUs from "@/messages/en-US.json";

export const SUPPORTED_LOCALES = ["en-GB", "en-US"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export type MessageCatalog = typeof enGb;

const CATALOGS: Readonly<Record<SupportedLocale, MessageCatalog>> = {
  "en-GB": enGb,
  "en-US": enUs,
};

export function getCatalog(locale: SupportedLocale = "en-GB"): MessageCatalog {
  return CATALOGS[locale];
}

function lookupPath(
  source: Record<string, unknown>,
  dottedKey: string,
): string | null {
  let cursor: unknown = source;
  for (const part of dottedKey.split(".")) {
    if (!cursor || typeof cursor !== "object") {
      return null;
    }
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return typeof cursor === "string" ? cursor : null;
}

export function formatCatalogMessage(
  dottedKey: string,
  values?: Record<string, string | number>,
  locale: SupportedLocale = "en-GB",
): string {
  const raw = lookupPath(
    CATALOGS[locale] as unknown as Record<string, unknown>,
    dottedKey,
  );
  if (raw === null) {
    throw new Error(`Missing catalog message key: ${dottedKey}`);
  }
  if (!values) {
    return raw;
  }
  return raw.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, name: string) => {
    const val = values[name];
    if (val === undefined) {
      throw new Error(`Missing ICU argument "${name}" for key "${dottedKey}"`);
    }
    return String(val);
  });
}

export function createCatalogTranslator(locale: SupportedLocale = "en-GB") {
  return (key: string, values?: Record<string, string | number>): string =>
    formatCatalogMessage(key, values, locale);
}
