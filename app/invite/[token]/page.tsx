import Link from "next/link";
import { inspectInviteToken } from "@/lib/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await inspectInviteToken(token);

  if (!invite) {
    return (
      <AuthShell
        eyebrow="Staff invitation"
        title="Invitation unavailable"
        description="This link is expired, revoked, or has already been used."
      >
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900">
          Ask an administrator on the Team page to generate a fresh seven-day invitation link.
        </p>
        <p className="mt-4 text-xs text-slate-500">
          Already set up?{" "}
          <Link href="/sign-in" className="font-semibold text-slate-950 underline">
            Sign in instead
          </Link>
          .
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Staff invitation"
      title="Finish setting up your account"
      description="Choose a strong password to claim your staff workspace invitation."
    >
      <AcceptInviteForm token={token} email={invite.email} />
    </AuthShell>
  );
}
