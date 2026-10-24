import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/server";

/**
 * Better Auth's own HTTP surface: sign-in, sign-out, session refresh,
 * two-factor verification and password reset. Route handlers are the only
 * place these endpoints are mounted; the app calls the server API directly
 * inside server actions.
 */
export const { GET, POST } = toNextJsHandler(auth);
