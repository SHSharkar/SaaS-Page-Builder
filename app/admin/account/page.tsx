import Link from "next/link";
import { requireActor } from "@/lib/auth/session";
import { listOwnPasskeys, listOwnSessions } from "@/lib/actions/account";
import { getSetting } from "@/lib/settings";
import { Alert, PageHeader, Panel } from "@/components/admin/ui";
import { PasskeyManager } from "@/components/auth/passkey-manager";
import { SessionList } from "@/components/auth/session-list";
import { TwoFactorManager } from "@/components/auth/two-factor-manager";
import { adminBadgeVariants, adminButtonVariants } from "@/lib/theme-classes";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ setup2fa?: string }>;
}) {
  const { setup2fa } = await searchParams;
  const actor = await requireActor({ allowWithoutTwoFactor: true });
  const [passkeys, sessions, requireTwoFactor] = await Promise.all([
    listOwnPasskeys(),
    listOwnSessions(),
    getSetting("security.require_two_factor"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Personal security"
        title="Your account"
        description="Manage your password, authenticator app, hardware passkeys, and active browser sessions."
        actions={
          <Link
            href="/admin/account/password"
            className={adminButtonVariants({ tone: "secondary" })}
          >
            Change password
          </Link>
        }
      />

      {setup2fa === "1" && !actor.user.twoFactorEnabled ? (
        <Alert tone="warning">
          Platform policy requires two-factor authentication on every staff account. Complete
          authenticator setup below to unlock the rest of the workspace.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-6">
          <Panel title="Profile & role">
            <dl className="space-y-2.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Name</dt>
                <dd className="font-semibold text-slate-950">{actor.user.name}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Work email</dt>
                <dd className="font-mono text-slate-900">{actor.user.email}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Assigned role</dt>
                <dd>
                  <span className={adminBadgeVariants({ tone: "blue" })}>
                    {actor.role?.name ?? actor.user.role}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Granted permissions</dt>
                <dd className="text-slate-900">{actor.permissions.size}</dd>
              </div>
            </dl>
          </Panel>

          <Panel
            title="Two-factor authentication"
            description="6-digit TOTP authenticator app and encrypted single-use recovery codes."
          >
            <TwoFactorManager
              enabled={actor.user.twoFactorEnabled}
              requiredByPolicy={requireTwoFactor && !actor.user.twoFactorEnabled}
            />
          </Panel>
        </div>

        <div className="space-y-6 lg:col-span-6">
          <Panel
            title="Passkeys"
            description="Sign in with Touch ID, Face ID, Windows Hello, or a hardware security key."
          >
            <PasskeyManager passkeys={passkeys} />
          </Panel>

          <Panel
            title="Active sessions"
            description="Every signed-in browser or device currently tied to your account."
          >
            <SessionList
              sessions={sessions.map((s) => ({
                id: s.id,
                ipAddress: s.ipAddress,
                userAgent: s.userAgent,
                createdAt: s.createdAt.toISOString(),
                expiresAt: s.expiresAt.toISOString(),
                current: s.id === actor.session.id,
              }))}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
