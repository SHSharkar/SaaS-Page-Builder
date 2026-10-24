import { and, asc, eq, isNull } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { pages } from "@/lib/db/schema";
import { resolveHost } from "@/lib/sites";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? url.host;
  const resolution = await resolveHost(host);
  if (!resolution || !resolution.canServe) {
    return new Response("Not found", { status: 404 });
  }

  await ensureDb();
  const rows = await db
    .select({ slug: pages.slug, updatedAt: pages.updatedAt, seo: pages.seo })
    .from(pages)
    .where(and(eq(pages.siteId, resolution.site.id), eq(pages.status, "published"), isNull(pages.deletedAt)))
    .orderBy(asc(pages.slug));

  const entries = rows
    .filter((row) => !row.seo?.noindex)
    .map((row) => {
      const loc = `https://${host}/${row.slug}`.replace(/\/$/, "") || `https://${host}`;
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${new Date(row.updatedAt).toISOString()}</lastmod>\n  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
