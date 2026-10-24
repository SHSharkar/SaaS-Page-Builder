import { toNextJsHandler } from "better-auth/next-js";
import type { NextRequest } from "next/server";
import { auth } from "@/app/server/auth/server";

const handlers = toNextJsHandler(auth);

export async function GET(request: NextRequest): Promise<Response> {
  return handlers.GET(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return handlers.POST(request);
}
