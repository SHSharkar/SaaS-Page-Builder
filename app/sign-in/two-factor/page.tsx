import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { TwoFactorForm } from "@/components/auth/two-factor-form";
import { getPendingTwoFactor, getActor } from "@/lib/auth/session";

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
  const pending = await getPendingTwoFactor();
  if (!pending) redirect("/sign-in");

  return (
    <AuthShell
      eyebrow="Second factor"
      title="One more check"
      description={`Enter the six-digit code from your authenticator app for ${pending.user.email}.`}
    >
      <TwoFactorForm next={target} />
    </AuthShell>
  );
}
