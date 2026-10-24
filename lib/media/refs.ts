import type { MediaRef } from "@/lib/documents";

export type ResolvedMedia = {
  id: string;
  url: string;
  alt?: string;
  width?: number | null;
  height?: number | null;
};

/**
 * Documents store media identifiers (ADR-004). The public renderer resolves
 * them from the database before rendering; the editor primes this lookup so
 * a freshly picked image previews instantly. URLs are never stored in a
 * document, which is what makes the reference check exact.
 */
const lookup = new Map<string, ResolvedMedia>();

export function primeMedia(items: ResolvedMedia[]): void {
  lookup.clear();
  for (const item of items) lookup.set(item.id, item);
}

export function lookupMedia(ref: MediaRef | null | undefined): ResolvedMedia | null {
  if (!ref || typeof ref.id !== "string") return null;
  if (ref.url) return { id: ref.id, url: ref.url, alt: ref.alt, width: ref.width, height: ref.height };
  return lookup.get(ref.id) ?? null;
}
