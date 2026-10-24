import type { NextConfig } from "next";
import { applyDevelopmentEnvDefaults } from "@/lib/development-env";

applyDevelopmentEnvDefaults();

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  allowedDevOrigins: ["*.e2b.app", "localhost", "127.0.0.1"],
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["@node-rs/argon2", "pg", "pg-boss", "pino", "sharp"],
  experimental: {
    turbopackFileSystemCacheForDev: true,
    serverActions: {
      bodySizeLimit: "6mb",
      allowedOrigins: ["*.e2b.app", "localhost:3000", "127.0.0.1:3000"],
    },
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
