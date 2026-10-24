import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function GET(request: NextRequest): NextResponse {
  const rawTitle =
    request.nextUrl.searchParams.get("title") ?? "SaaS Page Builder";
  const safeTitle = rawTitle.replace(/[<>&"']/g, "").slice(0, 80);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#0b1120"/><text x="80" y="300" fill="#f8fafc" font-family="sans-serif" font-size="56" font-weight="700">${safeTitle}</text><text x="80" y="380" fill="#60a5fa" font-family="sans-serif" font-size="28">SaaS Page Builder</text></svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
