import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/session";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { PasskeySignInButton } from "@/components/auth/passkey-sign-in";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const actor = await getCurrentActor();
  const { next } = await searchParams;
  if (actor) redirect(next && next.startsWith("/") ? next : "/admin");

  return (
    <AuthShell
      eyebrow="Staff workspace"
      title="Sign in"
      description="Use your work email and password, or a passkey registered on this account."
    >
      <div className="space-y-4">
        <SignInForm
          demo={DEMO_ACCOUNTS.map((account) => ({
            email: account.email,
            password: account.password,
          }))}
          next={next ?? null}
        />
        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-slate-200" />
          <span className="mx-3 text-[11px] uppercase tracking-wider text-slate-400">or</span>
          <div className="flex-grow border-t border-slate-200" />
        </div>
        <PasskeySignInButton next={next ?? null} />
      </div>
    </AuthShell>
  );
}
