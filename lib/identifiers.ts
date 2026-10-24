const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function publicSubscriberLabel(
  publicId: string,
  subscriberNumber: number,
): string {
  return `#${subscriberNumber} (${publicId.slice(0, 8)})`;
}
