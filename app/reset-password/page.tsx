import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const dynamic = "force-dynamic";

export default async function ResetPasswordQueryPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token || error) {
    return (
      <AuthShell
        eyebrow="Password reset"
        title="Reset link invalid or expired"
        description="Ask an administrator to issue a fresh one-hour password reset link."
      >
        <p className="text-xs text-slate-500">
          <Link href="/sign-in" className="font-semibold text-slate-950 underline">
            Return to sign-in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Password reset"
      title="Choose a new password"
      description="This link is single-use and expires one hour after an administrator issued it."
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
