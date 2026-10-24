import { redirect } from "next/navigation";

export default async function LegacyResetRedirect({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/reset-password/${encodeURIComponent(token)}`);
}
