import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { resolveExpiringShortLink } from "@/app/server/short-links";
import { CLIENT_IP_HEADER } from "@/proxy";

export const dynamic = "force-dynamic";

export default async function ShortLinkGoPage({
  params,
}: {
  readonly params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const hdrs = await headers();
  const clientIp = hdrs.get(CLIENT_IP_HEADER) ?? "127.0.0.1";
  const resolved = await resolveExpiringShortLink(code, clientIp);
  if (!resolved) {
    notFound();
  }
  redirect(resolved.targetPath);
}
