import { AuthShell } from "@/components/auth/auth-shell";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";
import { currentInvite } from "@/lib/actions/auth";

export const metadata = { title: "Accept invitation" };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await currentInvite(token);

  if (!invite) {
    return (
      <AuthShell
        eyebrow="Invitation"
        title="This link is no longer active"
        description="Invitations are single use and expire after seven days. Ask an admin to send a fresh one."
      >
        <a href="/sign-in" className="btn-admin btn-admin-primary w-full">
          Go to sign-in
        </a>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="You are invited"
      title={`Join as ${invite.roleName}`}
      description={`Set up your account for ${invite.email}. The link works once and expires ${invite.expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`}
    >
      <AcceptInviteForm token={token} email={invite.email} />
    </AuthShell>
  );
}
