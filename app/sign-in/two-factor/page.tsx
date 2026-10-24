import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/session";
import { AuthShell } from "@/components/auth/auth-shell";
import { TwoFactorForm } from "@/components/auth/two-factor-form";

export const dynamic = "force-dynamic";

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const actor = await getCurrentActor();
  const { next } = await searchParams;
  if (actor) redirect(next && next.startsWith("/") ? next : "/admin");

  return (
    <AuthShell
      eyebrow="Two-factor check"
      title="Enter your 6-digit code"
      description="Open your authenticator app or use one of your single-use recovery codes."
    >
      <TwoFactorForm next={next ?? null} />
    </AuthShell>
  );
}
