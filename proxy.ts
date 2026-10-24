import { type NextRequest, NextResponse } from "next/server";
import { normalizeAdminPath } from "@/app/lib/admin-path";
import { isCrawlerUserAgent } from "@/lib/crawler-agents";
import { normalizeHostname } from "@/lib/documents";
import { isShortLinkPathname } from "@/lib/short-paths";

export const DOMAIN_ID_HEADER = "x-spb-domain-host";
export const NONCE_HEADER = "x-nonce";
export const CLIENT_IP_HEADER = "x-spb-client-ip";

export const SESSION_COOKIE_NAMES = [
  "spb.session_token",
  "__Secure-spb.session_token",
] as const;

export const PERMISSIONS_POLICY =
  "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()";

const CUSTOM_DOMAIN_BLOCKED_PREFIXES = [
  "/admin",
  "/webhooks",
  "/api/auth",
  "/api/internal",
  "/dashboard",
  "/sites",
  "/templates",
  "/domains",
  "/media",
  "/imports",
  "/analytics",
  "/team",
  "/export",
  "/settings",
] as const;

function extractTrustedClientIp(request: NextRequest): string {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp && cfIp.trim().length > 0) {
    return cfIp.trim();
  }
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return "127.0.0.1";
}

function resolvePrimaryHost(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    return normalizeHostname(new URL(appUrl).hostname);
  } catch {
    return "localhost";
  }
}

function isPrimaryRequestHost(hostHeader: string | null): boolean {
  if (!hostHeader) {
    return true;
  }
  const normalized = normalizeHostname(hostHeader);
  if (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized.endsWith(".e2b.app")
  ) {
    return true;
  }
  return normalized === resolvePrimaryHost();
}

function buildCsp(nonce: string, allowPreviewFrame: boolean): string {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = isDev
    ? `'self' 'unsafe-inline' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;
  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    allowPreviewFrame ? "frame-ancestors *" : "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  return directives.join("; ");
}

function applySecurityHeaders(
  response: NextResponse,
  nonce: string,
  shortPath: boolean,
  allowPreviewFrame = false,
): NextResponse {
  response.headers.set(
    "Content-Security-Policy",
    buildCsp(nonce, allowPreviewFrame),
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  if (!allowPreviewFrame) {
    response.headers.set("X-Frame-Options", "DENY");
  }
  response.headers.set("Permissions-Policy", PERMISSIONS_POLICY);
  response.headers.set(
    "Referrer-Policy",
    shortPath ? "no-referrer" : "strict-origin-when-cross-origin",
  );
  if (shortPath) {
    response.headers.set("Cache-Control", "no-store, max-age=0");
  }
  return response;
}

function buildSanitizedRequestHeaders(
  request: NextRequest,
  nonce: string,
  customHost?: string,
): Headers {
  const headers = new Headers(request.headers);
  for (const key of [...headers.keys()]) {
    if (key.toLowerCase().startsWith("x-spb-")) {
      headers.delete(key);
    }
  }
  headers.set(NONCE_HEADER, nonce);
  headers.set(CLIENT_IP_HEADER, extractTrustedClientIp(request));
  if (customHost) {
    headers.set(DOMAIN_ID_HEADER, customHost);
  }
  return headers;
}

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) =>
    Boolean(request.cookies.get(name)?.value),
  );
}

function handleCustomDomainRequest(
  request: NextRequest,
  hostHeader: string | null,
  nonce: string,
  shortPath: boolean,
): NextResponse {
  const { pathname } = request.nextUrl;
  const customHost = normalizeHostname(hostHeader ?? "");
  const blocked = CUSTOM_DOMAIN_BLOCKED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (blocked) {
    return applySecurityHeaders(
      new NextResponse("Not Found", { status: 404 }),
      nonce,
      shortPath,
    );
  }
  if (pathname.startsWith("/api/") || pathname.startsWith("/s/")) {
    const headers = buildSanitizedRequestHeaders(request, nonce, customHost);
    return applySecurityHeaders(
      NextResponse.next({ request: { headers } }),
      nonce,
      shortPath,
    );
  }
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname =
    pathname === "/" ? "/s/_custom" : `/s/_custom${pathname}`;
  const headers = buildSanitizedRequestHeaders(request, nonce, customHost);
  return applySecurityHeaders(
    NextResponse.rewrite(rewriteUrl, { request: { headers } }),
    nonce,
    shortPath,
  );
}

function handleAdminRoute(
  request: NextRequest,
  adminPath: string,
  nonce: string,
): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (
    adminPath !== "/admin" &&
    (pathname === "/admin" || pathname.startsWith("/admin/"))
  ) {
    return applySecurityHeaders(
      new NextResponse("Not Found", { status: 404 }),
      nonce,
      false,
    );
  }
  if (pathname !== adminPath && !pathname.startsWith(`${adminPath}/`)) {
    return null;
  }
  if (!hasSessionCookie(request)) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    return applySecurityHeaders(NextResponse.redirect(signInUrl), nonce, false);
  }
  if (adminPath === "/admin") {
    return null;
  }
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = `/admin${pathname.slice(adminPath.length)}`;
  const headers = buildSanitizedRequestHeaders(request, nonce);
  return applySecurityHeaders(
    NextResponse.rewrite(rewriteUrl, { request: { headers } }),
    nonce,
    false,
  );
}

export function proxy(request: NextRequest): NextResponse {
  const nonce = crypto.randomUUID();
  const { pathname } = request.nextUrl;
  const shortPath = isShortLinkPathname(pathname);

  if (
    pathname.startsWith("/go/") &&
    isCrawlerUserAgent(request.headers.get("user-agent"))
  ) {
    return applySecurityHeaders(
      new NextResponse(null, { status: 200 }),
      nonce,
      true,
    );
  }

  const hostHeader = request.headers.get("host");
  const isPreviewHost = normalizeHostname(hostHeader ?? "").endsWith(
    ".e2b.app",
  );
  if (!isPrimaryRequestHost(hostHeader)) {
    return handleCustomDomainRequest(request, hostHeader, nonce, shortPath);
  }

  const adminPath = normalizeAdminPath(
    process.env.ADMIN_PATH ?? "/ops-console",
  );
  const adminResponse = handleAdminRoute(request, adminPath, nonce);
  if (adminResponse) {
    return adminResponse;
  }

  const headers = buildSanitizedRequestHeaders(request, nonce);
  return applySecurityHeaders(
    NextResponse.next({ request: { headers } }),
    nonce,
    shortPath,
    isPreviewHost,
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|marketing/).*)"],
};
