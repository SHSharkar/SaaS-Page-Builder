import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { db } from "@/lib/db";
import { accounts, sessions, twoFactors, users, verifications } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "./password";

/**
 * Authentication is Better Auth, not a hand-rolled session table.
 *
 * Better Auth owns identity: `user`, `account` (the password lives here, as a
 * credential account), `session`, `verification` and `two_factor`. The app owns
 * authorization: roles and permissions live in our own tables and are read by
 * `requirePermission` (see `lib/auth/rbac.ts`).
 *
 * Two deliberate settings:
 * - `disableSignUp` keeps the public sign-up endpoint closed. Accounts exist
 *   only because an admin created one or an invitation was accepted, so the
 *   invite-only rule cannot be bypassed by calling /api/auth/sign-up/email.
 * - The password hash/verify pair is ours (scrypt), which lets an existing
 *   database keep its users when the schema moves under Better Auth.
 */
export const auth = betterAuth({
  appName: "Trofēo Pages",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "trofeo-pages-development-secret-0123456789abcdef0123456789abcdef",
  basePath: "/api/auth",
  // The sandbox preview proxies the dev server through its own host, so the
  // browser origin is not the base URL. Production sets BETTER_AUTH_URL.
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    // The sandbox preview proxies the dev server through its own host, so the
    // browser origin is neither localhost nor the base URL.
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
    },
  }),
  advanced: {
    database: { generateId: () => globalThis.crypto.randomUUID() },
    // The preview runs behind a proxy; the cookie still stays http-only and
    // same-site, which is what matters for CSRF.
    defaultCookieAttributes: { sameSite: "lax", httpOnly: true, path: "/" },
  },
  emailAndPassword: {
    enabled: true,
    // No self-registration: invitations and admin-created accounts only.
    disableSignUp: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: false,
    password: {
      hash: async (password) => hashPassword(password),
      verify: async ({ hash, password }) => verifyPassword(password, hash),
    },
  },
  user: {
    additionalFields: {
      status: { type: "string", required: false, defaultValue: "active", input: false },
      mustChangePassword: { type: "boolean", required: false, defaultValue: false, input: false },
      twoFactorEnabled: { type: "boolean", required: false, defaultValue: false, input: false },
      lastSignInAt: { type: "date", required: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    // Freshness must be read from the database, never from a signed cookie.
    cookieCache: { enabled: false },
    additionalFields: {
      stepUpUntil: { type: "date", required: false, input: false },
    },
  },
  plugins: [twoFactor({ issuer: "Trofēo Pages" }), nextCookies()],
});

export type Auth = typeof auth;
