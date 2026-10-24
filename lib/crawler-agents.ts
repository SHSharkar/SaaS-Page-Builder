const CRAWLER_SUBSTRINGS = [
  "bot",
  "crawler",
  "spider",
  "whatsapp",
  "slackbot",
  "discordbot",
  "telegrambot",
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "preview",
] as const;

export function isCrawlerUserAgent(
  userAgent: string | null | undefined,
): boolean {
  if (!userAgent) {
    return false;
  }
  const normalized = userAgent.toLowerCase();
  return CRAWLER_SUBSTRINGS.some((token) => normalized.includes(token));
}
