export function normalizeAdminPath(rawPath: string | undefined): string {
  const trimmed = (rawPath ?? "/admin").trim();
  if (!trimmed || trimmed === "/") {
    return "/admin";
  }
  const prefixed = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return prefixed.replace(/\/+$/, "");
}

export function adminHref(
  subPath = "",
  rawAdminPath = process.env.NEXT_PUBLIC_ADMIN_PATH ?? "/admin",
): string {
  const base = normalizeAdminPath(rawAdminPath);
  if (!subPath || subPath === "/") {
    return base;
  }
  const cleanSub = subPath.startsWith("/") ? subPath : `/${subPath}`;
  return `${base}${cleanSub}`;
}
