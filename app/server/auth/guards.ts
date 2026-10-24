import "server-only";
import { redirect } from "next/navigation";
import { PUBLIC_PATHS } from "@/lib/paths";
import {
  accountRoleHasCapability,
  platformRoleHasCapability,
  type AccountCapability,
  type PlatformCapability,
} from "@/app/server/capabilities";
import { getSessionContext, type SessionContext } from "./session";

export class AuthorizationError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.statusCode = statusCode;
  }
}

export interface AccountActor extends SessionContext {
  readonly account: NonNullable<SessionContext["account"]>;
  readonly accountRole: NonNullable<SessionContext["accountRole"]>;
}

export async function requireAccountCapability(
  capability: AccountCapability,
): Promise<AccountActor> {
  const ctx = await getSessionContext();
  if (!ctx) {
    throw new AuthorizationError("Authentication required", 401);
  }
  if (!ctx.account || !ctx.accountRole || ctx.account.status !== "active") {
    throw new AuthorizationError("Active workspace membership required", 403);
  }
  if (!accountRoleHasCapability(ctx.accountRole, capability)) {
    throw new AuthorizationError(`Missing capability: ${capability}`, 403);
  }
  return ctx as AccountActor;
}

export async function requireAccountPageCapability(
  capability: AccountCapability,
): Promise<AccountActor> {
  const ctx = await getSessionContext();
  if (!ctx) {
    redirect(PUBLIC_PATHS.signIn);
  }
  if (!ctx.account || !ctx.accountRole || ctx.account.status !== "active") {
    redirect(PUBLIC_PATHS.signUp);
  }
  if (!accountRoleHasCapability(ctx.accountRole, capability)) {
    throw new AuthorizationError(`Missing capability: ${capability}`, 403);
  }
  return ctx as AccountActor;
}

export async function requirePlatformCapability(
  capability: PlatformCapability,
): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) {
    throw new AuthorizationError("Authentication required", 401);
  }
  if (!platformRoleHasCapability(ctx.platformRole, capability)) {
    throw new AuthorizationError(
      `Missing platform capability: ${capability}`,
      403,
    );
  }
  return ctx;
}

export async function requirePlatformPageCapability(
  capability: PlatformCapability,
): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) {
    redirect(PUBLIC_PATHS.signIn);
  }
  if (!platformRoleHasCapability(ctx.platformRole, capability)) {
    redirect(PUBLIC_PATHS.home);
  }
  return ctx;
}

export async function requirePublicActionRateLimit(
  scope: string,
  subject: string,
  limit = 15,
  windowSeconds = 60,
): Promise<void> {
  const { consumeSlidingBudget } = await import("@/app/server/redis/client");
  const { allowed } = await consumeSlidingBudget(
    `rl:public:${scope}:${subject}`,
    limit,
    windowSeconds,
  );
  if (!allowed) {
    throw new AuthorizationError("Rate limit exceeded", 429);
  }
}
