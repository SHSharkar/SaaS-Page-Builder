import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite is a WASM Postgres that must stay outside the bundler,
  // and cheerio ships CJS-only internals that are happier as a node module.
  serverExternalPackages: ["@electric-sql/pglite", "cheerio"],
  // The sandbox preview serves the dev server through a proxied host, so the
  // dev asset and HMR requests arrive cross-origin. Listing the preview domain
  // keeps hot reload working inside the embedded panel.
  allowedDevOrigins: ["*.e2b.app", "*.arena.ai"],
  images: {
    // Media is served by our own storage route in this build; in production the
    // same identifiers resolve to Cloudflare R2 public URLs.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // No X-Frame-Options: the staff screens must stay embeddable in the
          // hosted preview panel. Clickjacking is instead covered by the
          // same-origin admin session cookie (SameSite=Lax).
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
