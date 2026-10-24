import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { TwoFactorForm } from "@/components/auth/two-factor-form";
import { getActor } from "@/lib/auth/session";

export const metadata = { title: "Two-factor check" };
export const dynamic = "force-dynamic";

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next?.startsWith("/") && !next.startsWith("//") ? next : null;
  const actor = await getActor();
  if (actor) redirect(target ?? "/admin");
  // Better Auth holds the half-finished sign-in in its own short-lived cookie.
  // If it is gone the verify call below fails, so there is nothing to pre-check.

  return (
    <AuthShell
      eyebrow="Second factor"
      title="One more check"
      description="Enter the six-digit code from your authenticator app to finish signing in."
    >
      <TwoFactorForm next={target} />
    </AuthShell>
  );
}
