import { NextResponse } from "next/server";
import { listPublishedSlugsForSite, resolveSiteForHost } from "@/lib/public-page";
import { primaryHostname } from "@/lib/domains";

export const dynamic = "force-dynamic";

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request: Request) {
  const host = request.headers.get("host");
  const site = await resolveSiteForHost(host);
  if (!site) {
    return new NextResponse("Not found", { status: 404 });
  }
  const primary = (await primaryHostname(site.id)) ?? host ?? site.slug;
  const origin =
    primary.includes("localhost") || primary.includes(":")
      ? `http://${primary}`
      : `https://${primary}`;

  const pages = await listPublishedSlugsForSite(site.id);
  const urls = pages
    .map((page) => {
      const loc = page.slug ? `${origin}/${page.slug}` : origin;
      const lastmod = page.updatedAt.toISOString();
      return `  <url><loc>${xmlEscape(loc)}</loc><lastmod>${lastmod}</lastmod></url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
