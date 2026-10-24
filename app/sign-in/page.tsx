import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { PasskeySignInButton } from "@/components/auth/passkey-sign-in";
import { getActor } from "@/lib/auth/session";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next?.startsWith("/") && !next.startsWith("//") ? next : null;
  const actor = await getActor();
  if (actor) redirect(target ?? "/admin");

  const demo = DEMO_ACCOUNTS;

  return (
    <AuthShell
      eyebrow="Staff sign-in"
      title="Welcome back"
      description="This panel is for the Trofēo team only. Accounts are created by invitation from an admin."
      footer={
        <>
          Locked out? Invitations expire after seven days. An admin can revoke and resend from the
          team screen.
        </>
      }
    >
      <div className="space-y-5">
        <SignInForm demo={demo} next={target} />
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.12em] text-slate-400">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>
        <PasskeySignInButton next={target} />
      </div>
    </AuthShell>
  );
}
