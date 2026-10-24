import { NextResponse } from "next/server";
import { resolveSiteForHost } from "@/lib/public-page";
import { primaryHostname } from "@/lib/domains";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const host = request.headers.get("host");
  const site = await resolveSiteForHost(host);
  if (!site) {
    return new NextResponse("User-agent: *\nDisallow: /\n", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const primary = (await primaryHostname(site.id)) ?? host ?? site.slug;
  const origin =
    primary.includes("localhost") || primary.includes(":")
      ? `http://${primary}`
      : `https://${primary}`;

  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /edit",
    "Disallow: /preview",
    "Disallow: /api",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
