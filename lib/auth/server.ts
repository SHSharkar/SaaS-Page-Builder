import "server-only";
import { eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { db, schema } from "@/lib/db";
import { consumeRateLimit } from "@/lib/cache";
import { hashPassword, verifyPassword } from "./password";

const APP_NAME = "Trofeo Pages";
const SESSION_DAYS = 14;

const pendingResetCallbacks = new Map<string, (url: string) => void>();

export function registerResetIntercept(email: string, resolve: (url: string) => void): () => void {
  const normalized = email.trim().toLowerCase();
  pendingResetCallbacks.set(normalized, resolve);
  const timer = setTimeout(() => {
    pendingResetCallbacks.delete(normalized);
  }, 5_000);
  return () => {
    clearTimeout(timer);
    pendingResetCallbacks.delete(normalized);
  };
}

function resolveSecret(): string {
  const configured = process.env.BETTER_AUTH_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    throw new Error("BETTER_AUTH_SECRET must be set to at least 32 characters in production.");
  }
  return "trofeo-pages-dev-secret-change-in-production-0001";
}

function resolveBaseUrl(): string {
  return process.env.BETTER_AUTH_URL?.trim() || "http://localhost:3000";
}

function buildTrustedOrigins(request?: Request): string[] {
  const isProd = process.env.NODE_ENV === "production";
  const origins = new Set<string>([resolveBaseUrl(), "https://*.e2b.app"]);
  if (!isProd) {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }
  const platform = process.env.PLATFORM_DOMAIN?.trim();
  if (platform) {
    origins.add(`https://${platform}`);
    origins.add(`https://*.${platform}`);
  }
  if (request && !isProd) {
    const origin = request.headers.get("origin");
    if (origin) origins.add(origin);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    if (forwardedHost) {
      origins.add(`${proto}://${forwardedHost}`);
    }
  }
  return [...origins];
}

export const auth = betterAuth({
  appName: APP_NAME,
  secret: resolveSecret(),
  baseURL: resolveBaseUrl(),
  basePath: "/api/auth",
  trustedOrigins: (request) => buildTrustedOrigins(request),

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
      twoFactor: schema.twoFactors,
      passkey: schema.passkeys,
    },
  }),

  verification: {
    storeIdentifier: "hashed",
  },

  advanced: {
    database: { generateId: "uuid" },
    cookiePrefix: "trofeo",
    useSecureCookies: process.env.NODE_ENV === "production",
  },

  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: true,
    revokeSessionsOnPasswordReset: true,
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(hash, password),
    },
    async sendResetPassword({ user, url }) {
      const normalized = user.email.trim().toLowerCase();
      const receiver = pendingResetCallbacks.get(normalized);
      if (receiver) {
        pendingResetCallbacks.delete(normalized);
        receiver(url);
      }
    },
  },

  session: {
    expiresIn: SESSION_DAYS * 86_400,
    updateAge: 3_600,
    cookieCache: { enabled: false },
    additionalFields: {
      stepUpUntil: { type: "date", required: false, input: false },
    },
  },

  user: {
    additionalFields: {
      mustChangePassword: { type: "boolean", required: false, defaultValue: false, input: false },
      passwordChangedAt: { type: "date", required: false, input: false },
      lastSignInAt: { type: "date", required: false, input: false },
    },
  },

  databaseHooks: {
    session: {
      create: {
        async before(sessionRow) {
          const [userRow] = await db
            .select({ banned: schema.users.banned, banExpires: schema.users.banExpires })
            .from(schema.users)
            .where(eq(schema.users.id, sessionRow.userId))
            .limit(1);
          if (!userRow) return false;
          if (userRow.banned && (!userRow.banExpires || userRow.banExpires > new Date())) {
            return false;
          }
          return { data: sessionRow };
        },
      },
    },
    user: {
      update: {
        async after(updatedUser) {
          const flagged = (updatedUser as { banned?: boolean }).banned;
          if (flagged) {
            await db.delete(schema.sessions).where(eq(schema.sessions.userId, updatedUser.id));
          }
        },
      },
    },
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 120,
    customStorage: {
      async consume(key, rule) {
        const decision = await consumeRateLimit("auth", key, rule.max, rule.window);
        return {
          allowed: decision.allowed,
          retryAfter: decision.allowed ? null : decision.retryAfterSeconds,
        };
      },
    },
    customRules: {
      "/sign-in/email": { window: 60, max: 12 },
      "/two-factor/*": { window: 60, max: 10 },
      "/change-password": { window: 60, max: 8 },
    },
  },

  plugins: [
    admin({
      defaultRole: "viewer",
      adminRoles: ["admin"],
      impersonationSessionDuration: 3_600,
      bannedUserMessage: "This account has been suspended. Ask an administrator.",
    }),
    twoFactor({
      issuer: APP_NAME,
      totpOptions: { digits: 6, period: 30 },
      backupCodeOptions: { amount: 8, length: 10 },
    }),
    passkey({
      rpName: APP_NAME,
    }),
    nextCookies(),
  ],
});

export type AuthInstance = typeof auth;
