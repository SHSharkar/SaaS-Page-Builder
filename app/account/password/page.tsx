import { AuthShell } from "@/components/auth/auth-shell";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { SessionList } from "@/components/auth/session-list";
import { requireActor, roleLabels } from "@/lib/auth/session";
import { listSessions } from "@/lib/auth/rbac";

export const metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

export default async function AccountPasswordPage() {
  const actor = await requireActor();
  const forced = actor.user.mustChangePassword;
  const sessions = await listSessions({ userId: actor.user.id });

  return (
    <AuthShell
      eyebrow={forced ? "First sign-in" : "Your account"}
      title={forced ? "Choose your own password" : "Change your password"}
      description={
        forced
          ? "An admin created this account with a temporary password. Replace it before you carry on."
          : `${actor.user.email} · ${roleLabels(actor)}. Changing it signs your other devices out.`
      }
      footer={
        <a href="/admin" className="underline">
          Back to the dashboard
        </a>
      }
    >
      <div className="space-y-6">
        <ChangePasswordForm forced={forced} />
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Where you are signed in</p>
          <SessionList
            sessions={sessions.map((session) => ({
              id: session.id,
              ipAddress: session.ipAddress,
              userAgent: session.userAgent,
              createdAt: session.createdAt.toISOString(),
              expiresAt: session.expiresAt.toISOString(),
              current: session.id === actor.session.id,
            }))}
          />
        </div>
      </div>
    </AuthShell>
  );
}
