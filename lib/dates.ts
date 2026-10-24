const DATE_CACHE = new Map<string, Intl.DateTimeFormat>();

function getFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  const cached = DATE_CACHE.get(key);
  if (cached) {
    return cached;
  }
  const created = new Intl.DateTimeFormat(locale, options);
  DATE_CACHE.set(key, created);
  return created;
}

function toDate(value: Date | string | number): Date {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date input");
  }
  return parsed;
}

export function formatShortDate(
  value: Date | string | number,
  locale = "en-GB",
): string {
  return getFormatter(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(toDate(value));
}

export function formatDateTime(
  value: Date | string | number,
  locale = "en-GB",
): string {
  return getFormatter(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(toDate(value));
}

export function formatIsoDate(value: Date | string | number): string {
  return toDate(value).toISOString().slice(0, 10);
}
