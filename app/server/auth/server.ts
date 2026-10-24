import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { db } from "@/app/server/db/client";
import * as schema from "@/app/server/db/schema";
import { getEnv } from "@/app/server/env";
import { hashPassword, verifyPassword } from "./password";

function buildTrustedOrigins(): string[] {
  const env = getEnv();
  const origins = new Set<string>([
    env.BETTER_AUTH_URL,
    `https://${env.PRIMARY_DOMAIN}`,
    `https://*.${env.PLATFORM_DOMAIN}`,
    "https://*.e2b.app",
  ]);
  if (env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }
  return [...origins];
}

export const auth = betterAuth({
  appName: "SaaS Page Builder",
  secret: getEnv().BETTER_AUTH_SECRET,
  baseURL: getEnv().BETTER_AUTH_URL,
  basePath: "/api/auth",
  trustedOrigins: buildTrustedOrigins(),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.authSessions,
      account: schema.authAccounts,
      verification: schema.authVerifications,
      twoFactor: schema.authTwoFactors,
      passkey: schema.authPasskeys,
    },
  }),
  account: {
    fields: {
      accountId: "accountId",
    },
  },
  advanced: {
    database: { generateId: "uuid" },
    cookiePrefix: "spb",
    useSecureCookies: getEnv().NODE_ENV === "production",
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: true,
    revokeSessionsOnPasswordReset: true,
    password: {
      hash: hashPassword,
      verify: ({ hash: storedHash, password }) =>
        verifyPassword(storedHash, password),
    },
  },
  session: {
    expiresIn: 14 * 86_400,
    updateAge: 3_600,
    cookieCache: { enabled: false },
  },
  plugins: [twoFactor(), passkey(), nextCookies()],
});
