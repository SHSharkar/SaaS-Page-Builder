import type { MediaRef } from "@/lib/documents";

export type ResolvedMedia = {
  id: string;
  url: string;
  alt?: string;
  width?: number | null;
  height?: number | null;
};

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
