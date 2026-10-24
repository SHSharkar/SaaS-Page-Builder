import { resolveHost } from "@/lib/sites";

export const dynamic = "force-dynamic";

/**
 * Preview and staff surfaces are never indexable, on every host. A site that
 * has not launched can also be blocked wholesale from the settings screen.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? url.host;
  const resolution = await resolveHost(host);

  const sitemapLine = resolution?.canServe ? `Sitemap: https://${host}/sitemap.xml\n` : "";
  const body = [
    "User-agent: *",
    "Disallow: /admin",
    "Disallow: /edit",
    "Disallow: /preview",
    "Disallow: /api",
    "Disallow: /invite",
    "Allow: /",
    "",
    sitemapLine,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
