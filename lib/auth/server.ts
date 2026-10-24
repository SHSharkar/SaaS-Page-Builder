import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { db } from "@/lib/db";
import {
  accounts,
  passkeys,
  rateLimits,
  sessions,
  staffResetLinks,
  twoFactors,
  users,
  verifications,
} from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "./password";

export const staffManagerIds: string[] = [];

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const relyingParty = new URL(baseURL);

export const auth = betterAuth({
  appName: "Trofēo Pages",
  baseURL,
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "trofeo-pages-development-secret-0123456789abcdef0123456789abcdef",
  basePath: "/api/auth",
  trustedOrigins: [
    baseURL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://*.e2b.app",
    "https://*.arena.ai",
  ],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
      twoFactor: twoFactors,
      passkey: passkeys,
      rateLimit: rateLimits,
    },
  }),
  advanced: {
    database: { generateId: () => globalThis.crypto.randomUUID() },
    defaultCookieAttributes: { sameSite: "lax", httpOnly: true, path: "/" },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 120,
    storage: "database",
    modelName: "rateLimit",
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: false,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    password: {
      hash: async (password) => hashPassword(password),
      verify: async ({ hash, password }) => verifyPassword(password, hash),
    },
    sendResetPassword: async ({ user, url }) => {
      await db.insert(staffResetLinks).values({
        userId: user.id,
        url,
        expiresAt: new Date(Date.now() + 60 * 60_000),
      });
    },
  },
  user: {
    additionalFields: {
      mustChangePassword: { type: "boolean", required: false, defaultValue: false, input: false },
      lastSignInAt: { type: "date", required: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
    additionalFields: {
      stepUpUntil: { type: "date", required: false, input: false },
    },
  },
  plugins: [
    admin({
      defaultRole: "viewer",
      adminUserIds: staffManagerIds,
    }),
    twoFactor({ issuer: "Trofēo Pages" }),
    passkey({
      rpID: process.env.PASSKEY_RP_ID ?? relyingParty.hostname,
      rpName: "Trofēo Pages",
      origin: process.env.PASSKEY_ORIGIN ?? relyingParty.origin,
    }),
    nextCookies(),
  ],
});

export type Auth = typeof auth;
