import type { NextConfig } from "next";

const nextConfig: NextConfig = {

  serverExternalPackages: ["@electric-sql/pglite", "cheerio"],

  allowedDevOrigins: ["*.e2b.app", "*.arena.ai"],
  images: {

    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
