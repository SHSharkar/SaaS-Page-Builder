import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const dynamic = "force-dynamic";

export default async function ResetPasswordTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
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
