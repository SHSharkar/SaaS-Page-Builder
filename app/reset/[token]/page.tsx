import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = { title: "Reset your password" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <AuthShell
      eyebrow="Password reset"
      title="Set a new password"
      description="This link works once and expires an hour after an admin creates it."
      footer={
        <a href="/sign-in" className="underline">
          Back to sign-in
        </a>
      }
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
