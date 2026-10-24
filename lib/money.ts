const NUMBER_CACHE = new Map<string, Intl.NumberFormat>();

function getNumberFormatter(
  locale: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  const cached = NUMBER_CACHE.get(key);
  if (cached) {
    return cached;
  }
  const created = new Intl.NumberFormat(locale, options);
  NUMBER_CACHE.set(key, created);
  return created;
}

export function formatMinorMoney(
  minorUnits: number,
  currency = "USD",
  locale = "en-US",
): string {
  if (!Number.isFinite(minorUnits)) {
    throw new Error("Invalid minor money amount");
  }
  return getNumberFormatter(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
}

export function formatCount(count: number, locale = "en-US"): string {
  if (!Number.isFinite(count)) {
    throw new Error("Invalid count");
  }
  return getNumberFormatter(locale, {
    maximumFractionDigits: 0,
  }).format(Math.trunc(count));
}
