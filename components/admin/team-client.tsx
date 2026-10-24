"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  banMemberAction,
  createStaffAccountAction,
  impersonateMemberAction,
  inviteStaffAction,
  removeMemberAction,
  resendInviteAction,
  resetUserPasswordAction,
  revokeAllUserSessionsAction,
  revokeInviteAction,
  revokeUserSessionAction,
  setMemberRoleAction,
  setTemporaryPasswordAction,
  unbanMemberAction,
} from "@/lib/actions/team";
import { StatusBadge } from "@/components/admin/ui";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { CopyInline, Notice, type ActionResult } from "@/components/admin/action";
import {
  adminBadgeVariants,
  adminButtonVariants,
  adminInputClass,
  adminLabelClass,
  adminSelectClass,
} from "@/lib/theme-classes";

type RoleOption = {
  id: string;
  key: string;
  name: string;
  rank: number;
  isSystem: boolean;
  permissionCount: number;
};

type MemberRow = {
  id: string;
  name: string;
  email: string;
  status: "active" | "suspended";
  bannedReason: string | null;
  roleId: string | null;
  roleKey: string;
  roleName: string;
  rank: number;
  twoFactorEnabled: boolean;
  mustChangePassword: boolean;
  passkeyCount: number;
  activeSessionCount: number;
  lastSignInAt: string | null;
};

type InviteRow = {
  id: string;
  email: string;
  roleName: string;
  status: string;
  expiresAt: string;
};

type LiveSessionRow = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
};

export function InviteForm({
  roles,
  actorRank,
}: {
  roles: RoleOption[];
  actorRank: number;
}) {
  const router = useRouter();
  const assignable = roles.filter((role) => role.rank <= actorRank);
  const defaultRole = assignable.find((role) => role.key === "editor") ?? assignable[0];
  const [mode, setMode] = useState<"invite" | "direct">("invite");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(defaultRole?.id ?? "");
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[12px]">
        <button
          type="button"
          onClick={() => {
            setMode("invite");
            setState(null);
          }}
          className={`rounded-md px-3 py-1 font-medium transition ${
            mode === "invite" ? "bg-white text-slate-950 shadow-xs" : "text-slate-500"
          }`}
        >
          Send invitation link
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("direct");
            setState(null);
          }}
          className={`rounded-md px-3 py-1 font-medium transition ${
            mode === "direct" ? "bg-white text-slate-950 shadow-xs" : "text-slate-500"
          }`}
        >
          Create account directly
        </button>
      </div>

      {mode === "invite" ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const res = await inviteStaffAction({ email, roleId });
              setState(res);
              if (res.ok) {
                setEmail("");
                router.refresh();
              }
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className={adminLabelClass} htmlFor="invite-email">
                Work email
              </label>
              <input
                id="invite-email"
                type="email"
                required
                className={adminInputClass}
                placeholder="colleague@trofeo.example"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div>
              <label className={adminLabelClass} htmlFor="invite-role">
                Starting role
              </label>
              <select
                id="invite-role"
                className={adminSelectClass}
                value={roleId}
                onChange={(event) => setRoleId(event.target.value)}
              >
                {assignable.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name} ({role.permissionCount})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            className={adminButtonVariants({ tone: "primary" })}
            disabled={pending}
          >
            {pending ? "Creating link..." : "Generate 7-day invitation"}
          </button>
        </form>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const res = await createStaffAccountAction({ name, email, password, roleId });
              setState(res);
              if (res.ok) {
                setName("");
                setEmail("");
                setPassword("");
                router.refresh();
              }
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={adminLabelClass} htmlFor="direct-name">
                Full name
              </label>
              <input
                id="direct-name"
                required
                className={adminInputClass}
                placeholder="Samira Patel"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div>
              <label className={adminLabelClass} htmlFor="direct-email">
                Work email
              </label>
              <input
                id="direct-email"
                type="email"
                required
                className={adminInputClass}
                placeholder="samira@trofeo.example"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div>
              <label className={adminLabelClass} htmlFor="direct-pw">
                Temporary password
              </label>
              <input
                id="direct-pw"
                type="password"
                required
                minLength={10}
                maxLength={128}
                className={adminInputClass}
                placeholder="At least 10 characters, letters and numbers"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div>
              <label className={adminLabelClass} htmlFor="direct-role">
                Role
              </label>
              <select
                id="direct-role"
                className={adminSelectClass}
                value={roleId}
                onChange={(event) => setRoleId(event.target.value)}
              >
                {assignable.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name} ({role.permissionCount})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            They will be asked to choose their own password the moment they sign in.
          </p>
          <button
            type="submit"
            className={adminButtonVariants({ tone: "primary" })}
            disabled={pending}
          >
            {pending ? "Creating..." : "Create account"}
          </button>
        </form>
      )}

      <Notice state={state} />
      {state?.inviteUrl ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
          <code className="break-all font-mono text-[11px] text-slate-800">
            {typeof window !== "undefined" ? window.location.origin : ""}
            {state.inviteUrl}
          </code>
          <CopyInline
            value={`${typeof window !== "undefined" ? window.location.origin : ""}${state.inviteUrl}`}
            label="Copy link"
          />
        </div>
      ) : null}
    </div>
  );
}

export function MembersList({
  members,
  roles,
  canManage,
  actorId,
  actorRank,
}: {
  members: MemberRow[];
  roles: RoleOption[];
  canManage: boolean;
  actorId: string;
  actorRank: number;
}) {
  const router = useRouter();
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<Record<string, string>>({});
  const [banReason, setBanReason] = useState<Record<string, string>>({});
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<MemberRow | null>(null);

  const assignableRoles = roles.filter((role) => role.rank <= actorRank);

  return (
    <div className="space-y-3">
      <Notice state={state} />
      {state?.resetUrl ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
          <code className="break-all font-mono text-[11px] text-amber-950">{state.resetUrl}</code>
          <CopyInline value={state.resetUrl} label="Copy reset link" />
        </div>
      ) : null}

      <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {members.map((member) => {
          const isSelf = member.id === actorId;
          const outranked = member.rank > actorRank;
          const editable = canManage && !outranked;
          const expanded = openMenuId === member.id;

          return (
            <div key={member.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-950">{member.name}</span>
                    {isSelf ? (
                      <span className={adminBadgeVariants({ tone: "blue" })}>you</span>
                    ) : null}
                    <StatusBadge
                      status={member.status}
                      label={member.status === "suspended" ? "banned" : "active"}
                    />
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      {member.roleName}
                    </span>
                    {member.twoFactorEnabled ? (
                      <span className={adminBadgeVariants({ tone: "green" })}>2FA</span>
                    ) : null}
                    {member.passkeyCount > 0 ? (
                      <span className={adminBadgeVariants({ tone: "gray" })}>
                        {member.passkeyCount} passkey{member.passkeyCount === 1 ? "" : "s"}
                      </span>
                    ) : null}
                    {member.mustChangePassword ? (
                      <span className={adminBadgeVariants({ tone: "amber" })}>
                        password change due
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {member.email} | {member.activeSessionCount} active session
                    {member.activeSessionCount === 1 ? "" : "s"} | last sign-in{" "}
                    {member.lastSignInAt
                      ? new Date(member.lastSignInAt).toLocaleDateString("en-US", {
                          day: "numeric",
                          month: "short",
                        })
                      : "never"}
                  </p>
                  {member.bannedReason ? (
                    <p className="mt-1 text-[11px] text-red-700">Reason: {member.bannedReason}</p>
                  ) : null}
                </div>

                {editable ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Role for ${member.name}`}
                      className={`${adminSelectClass} w-auto py-1.5 text-xs`}
                      value={member.roleId ?? ""}
                      disabled={pending}
                      onChange={(event) => {
                        const nextRoleId = event.target.value;
                        if (!nextRoleId) return;
                        startTransition(async () => {
                          const res = await setMemberRoleAction({
                            userId: member.id,
                            roleId: nextRoleId,
                          });
                          setState(res);
                          router.refresh();
                        });
                      }}
                    >
                      {assignableRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={adminButtonVariants({ tone: "secondary", size: "sm" })}
                      onClick={() => setOpenMenuId(expanded ? null : member.id)}
                    >
                      {expanded ? "Hide controls" : "Account controls"}
                    </button>
                  </div>
                ) : null}
              </div>

              {editable && expanded ? (
                <div className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="font-semibold text-slate-800">Credentials & sessions</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={pending}
                        className={adminButtonVariants({ tone: "secondary", size: "sm" })}
                        onClick={() =>
                          startTransition(async () => {
                            const res = await resetUserPasswordAction({ userId: member.id });
                            setState(res);
                          })
                        }
                      >
                        Issue 1h reset link
                      </button>
                      <button
                        type="button"
                        disabled={pending || member.activeSessionCount === 0}
                        className={adminButtonVariants({ tone: "secondary", size: "sm" })}
                        onClick={() =>
                          startTransition(async () => {
                            const res = await revokeAllUserSessionsAction({ userId: member.id });
                            setState(res);
                            router.refresh();
                          })
                        }
                      >
                        Sign out all devices
                      </button>
                      {!isSelf && member.status === "active" ? (
                        <button
                          type="button"
                          disabled={pending}
                          className={adminButtonVariants({ tone: "secondary", size: "sm" })}
                          onClick={() =>
                            startTransition(async () => {
                              const res = await impersonateMemberAction({ userId: member.id });
                              if (res && !res.ok) setState(res);
                            })
                          }
                        >
                          View as {member.name.split(" ")[0]}
                        </button>
                      ) : null}
                    </div>
                    <div className="flex gap-1.5 pt-1">
                      <input
                        type="password"
                        className={`${adminInputClass} py-1 text-xs`}
                        placeholder="Set temporary password..."
                        value={tempPassword[member.id] ?? ""}
                        onChange={(event) =>
                          setTempPassword({ ...tempPassword, [member.id]: event.target.value })
                        }
                      />
                      <button
                        type="button"
                        disabled={pending || !(tempPassword[member.id]?.length >= 10)}
                        className={`${adminButtonVariants({ tone: "secondary", size: "sm" })} shrink-0`}
                        onClick={() =>
                          startTransition(async () => {
                            const res = await setTemporaryPasswordAction({
                              userId: member.id,
                              password: tempPassword[member.id] ?? "",
                            });
                            setState(res);
                            if (res.ok) {
                              setTempPassword({ ...tempPassword, [member.id]: "" });
                              router.refresh();
                            }
                          })
                        }
                      >
                        Set
                      </button>
                    </div>
                  </div>

                  {!isSelf ? (
                    <div className="space-y-2">
                      <p className="font-semibold text-slate-800">Access status</p>
                      {member.status === "active" ? (
                        <div className="flex gap-1.5">
                          <input
                            className={`${adminInputClass} py-1 text-xs`}
                            placeholder="Reason for ban (shown in audit log)"
                            value={banReason[member.id] ?? ""}
                            onChange={(event) =>
                              setBanReason({ ...banReason, [member.id]: event.target.value })
                            }
                          />
                          <button
                            type="button"
                            disabled={pending}
                            className={`${adminButtonVariants({ tone: "danger", size: "sm" })} shrink-0`}
                            onClick={() =>
                              startTransition(async () => {
                                const res = await banMemberAction({
                                  userId: member.id,
                                  reason: banReason[member.id] ?? "",
                                });
                                setState(res);
                                router.refresh();
                              })
                            }
                          >
                            Ban
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={pending}
                          className={adminButtonVariants({ tone: "secondary", size: "sm" })}
                          onClick={() =>
                            startTransition(async () => {
                              const res = await unbanMemberAction({ userId: member.id });
                              setState(res);
                              router.refresh();
                            })
                          }
                        >
                          Lift ban
                        </button>
                      )}
                      <div className="pt-1">
                        <button
                          type="button"
                          disabled={pending}
                          className="text-[11px] font-medium text-red-700 underline"
                          onClick={() => setConfirmRemoveMember(member)}
                        >
                          Delete account permanently
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <ConfirmModal
        open={confirmRemoveMember !== null}
        title="Delete staff account"
        description={
          confirmRemoveMember
            ? `Permanently delete the account for ${confirmRemoveMember.name} (${confirmRemoveMember.email})? Published content stays intact, but all sessions and credentials for this person are erased.`
            : ""
        }
        confirmLabel="Delete account"
        tone="danger"
        pending={pending}
        onCancel={() => setConfirmRemoveMember(null)}
        onConfirm={() => {
          if (!confirmRemoveMember) return;
          const targetId = confirmRemoveMember.id;
          setConfirmRemoveMember(null);
          startTransition(async () => {
            const res = await removeMemberAction({ userId: targetId });
            setState(res);
            router.refresh();
          });
        }}
      />
    </div>
  );
}

export function InvitesList({
  invites,
  canManage,
}: {
  invites: InviteRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (invites.length === 0) {
    return <p className="text-xs text-slate-500">No invitations have been sent yet.</p>;
  }

  return (
    <div className="space-y-3">
      <Notice state={state} />
      {state?.inviteUrl ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
          <code className="break-all font-mono text-[11px]">
            {typeof window !== "undefined" ? window.location.origin : ""}
            {state.inviteUrl}
          </code>
          <CopyInline
            value={`${typeof window !== "undefined" ? window.location.origin : ""}${state.inviteUrl}`}
            label="Copy link"
          />
        </div>
      ) : null}
      <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{invite.email}</span>
                <StatusBadge status={invite.status} />
                <span className="text-slate-400">as {invite.roleName}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Expires{" "}
                {new Date(invite.expiresAt).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            {canManage && invite.status === "pending" ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className={adminButtonVariants({ tone: "secondary", size: "sm" })}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await resendInviteAction(invite.id);
                      setState(res);
                      router.refresh();
                    })
                  }
                >
                  Reissue link
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className={adminButtonVariants({ tone: "danger", size: "sm" })}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await revokeInviteAction(invite.id);
                      setState(res);
                      router.refresh();
                    })
                  }
                >
                  Revoke
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LiveSessionsPanel({
  sessions,
  currentSessionId,
  canManage,
}: {
  sessions: LiveSessionRow[];
  currentSessionId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (sessions.length === 0) {
    return <p className="text-xs text-slate-500">No active sessions right now.</p>;
  }

  return (
    <div className="space-y-3">
      <Notice state={state} />
      <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {sessions.map((session) => {
          const current = session.id === currentSessionId;
          return (
            <div
              key={session.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{session.name}</span>
                  <span className="text-slate-400">{session.email}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                    {session.role}
                  </span>
                  {current ? (
                    <span className={adminBadgeVariants({ tone: "green" })}>this device</span>
                  ) : null}
                </div>
                <p className="mt-0.5 break-words text-[11px] text-slate-400">
                  {session.ipAddress ?? "no IP recorded"} |{" "}
                  {(session.userAgent ?? "browser").slice(0, 72)}
                </p>
              </div>
              {canManage && !current ? (
                <button
                  type="button"
                  disabled={pending}
                  className={adminButtonVariants({ tone: "secondary", size: "sm" })}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await revokeUserSessionAction({ sessionId: session.id });
                      setState(res);
                      router.refresh();
                    })
                  }
                >
                  End session
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
