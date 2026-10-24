import { notFound, redirect } from "next/navigation";
import { resolveDurableScanShare } from "@/app/server/short-links";
import { PUBLIC_PATHS } from "@/lib/paths";

export const dynamic = "force-dynamic";

export default async function ScanSharePage({
  params,
}: {
  readonly params: Promise<{ segment: string }>;
}) {
  const { segment } = await params;
  const resolved = await resolveDurableScanShare(segment);
  if (!resolved) {
    notFound();
  }
  redirect(PUBLIC_PATHS.publishedSite(resolved.siteSlug));
}
