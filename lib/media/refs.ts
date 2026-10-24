export type MediaRef = {
  id: string;
  alt?: string;
  focalX?: number;
  focalY?: number;
};

export type ResolvedMedia = {
  id: string;
  url: string;
  alt: string;
  width?: number | null;
  height?: number | null;
  focalX?: number;
  focalY?: number;
};

export function isMediaRef(value: unknown): value is MediaRef {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    "id" in (value as Record<string, unknown>) &&
    typeof (value as MediaRef).id === "string"
  );
}

export function lookupMedia(value: unknown): ResolvedMedia | null {
  if (!isMediaRef(value)) return null;
  const obj = value as Record<string, unknown>;
  const focalPoint = obj.focalPoint as { x?: number; y?: number } | undefined;
  return {
    id: String(obj.id),
    url: typeof obj.url === "string" ? obj.url : "",
    alt: typeof obj.alt === "string" ? obj.alt : "",
    width: typeof obj.width === "number" ? obj.width : null,
    height: typeof obj.height === "number" ? obj.height : null,
    focalX: typeof obj.focalX === "number" ? obj.focalX : focalPoint?.x,
    focalY: typeof obj.focalY === "number" ? obj.focalY : focalPoint?.y,
  };
}

export function collectMediaIds(node: unknown, out = new Set<string>()): Set<string> {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) collectMediaIds(item, out);
    return out;
  }
  const obj = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    if (
      (key === "media" ||
        key === "image" ||
        key === "logo" ||
        key === "background" ||
        key === "avatar" ||
        key === "poster" ||
        key.endsWith("Media") ||
        key.endsWith("Image")) &&
      isMediaRef(value)
    ) {
      if (value.id) out.add(value.id);
      continue;
    }
    if (
      (key === "mediaId" || key === "logoMediaId" || key === "shareImageId") &&
      typeof value === "string" &&
      value
    ) {
      out.add(value);
      continue;
    }
    collectMediaIds(value, out);
  }
  return out;
}
