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
  setMemberRoleAction,
  unbanMemberAction,
} from "@/lib/actions/team";
import { CopyInline, Notice } from "./action";

type RoleRef = { id: string; name: string; isSystem: boolean; rank: number };

type Member = {
  id: string;
  name: string;
  email: string;
  roleKey: string;
  role: RoleRef | null;
  banned: boolean;
  banReason: string | null;
  banExpires: string | null;
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
  lastSignInAt: string | null;
  sessionCount: number;
  passkeyCount: number;
};

type Invite = {
  id: string;
  email: string;
  roleId: string;
  roleName: string;
  status: string;
  expiresAt: string;
  expired: boolean;
  invitedByName: string | null;
};

type Result = { ok: boolean; error?: string; message?: string; inviteUrl?: string; resetUrl?: string };
type Feedback = Result | null;

function when(value: string | null): string {
  if (!value) return "never";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TeamPanel({
  members,
  invites,
  roles,
  currentUserId,
  canManage,
}: {
  members: Member[];
  invites: Invite[];
  roles: RoleRef[];
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState(roles.find((role) => role.rank === 50)?.id ?? roles[0]?.id ?? "");
  const [createRoleId, setCreateRoleId] = useState(roles.find((role) => role.rank === 10)?.id ?? roles[0]?.id ?? "");
  const [state, setState] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<Result>) =>
    startTransition(async () => {
      const result = await fn();
      setState(result);
      router.refresh();
    });

  return (
    <div className="space-y-5">
      <Notice state={state} className="max-w-3xl" />

      <section className="card overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Accounts</h2>
            <p className="text-[11px] text-slate-500">
              One role per person, enforced on the server. Banning an account ends its sessions immediately.
            </p>
          </div>
          <span className="badge badge-gray">{members.length} people</span>
        </header>
        <div className="divide-y divide-line">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              roles={roles}
              canManage={canManage}
              isSelf={member.id === currentUserId}
              onResult={setState}
              refresh={() => router.refresh()}
            />
          ))}
        </div>
      </section>
      {canManage ? (
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-ink-900">Invite a teammate</h2>
            <p className="mt-1 text-[11px] text-slate-500">
              A one-time link expires in seven days. The invitee chooses their own password.
            </p>
            <form
              className="mt-3 space-y-3"
              action={(formData) =>
                run(() =>
                  inviteStaffAction({
                    email: String(formData.get("email") ?? ""),
                    roleId: String(formData.get("roleId") ?? ""),
                  }),
                )
              }
            >
              <div>
                <label className="label" htmlFor="invite-email">
                  Email
                </label>
                <input
                  id="invite-email"
                  name="email"
                  type="email"
                  required
                  className="input"
                  placeholder="name@trofeo.example"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="invite-role">
                  Role
                </label>
                <select
                  id="invite-role"
                  name="roleId"
                  className="input"
                  value={inviteRoleId}
                  onChange={(event) => setInviteRoleId(event.target.value)}
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-admin btn-admin-primary" disabled={pending}>
                {pending ? "Creating…" : "Create invite link"}
              </button>
            </form>
          </div>
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-ink-900">Create an account directly</h2>
            <p className="mt-1 text-[11px] text-slate-500">
              For people who cannot use an invite link. They are forced to set their own password at first sign-in.
            </p>
            <form
              className="mt-3 space-y-3"
              action={(formData) =>
                run(() =>
                  createStaffAccountAction({
                    name: String(formData.get("name") ?? ""),
                    email: String(formData.get("email") ?? ""),
                    password: String(formData.get("password") ?? ""),
                    roleId: String(formData.get("roleId") ?? ""),
                  }),
                )
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="new-name">
                    Full name
                  </label>
                  <input id="new-name" name="name" required minLength={2} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="new-email">
                    Email
                  </label>
                  <input id="new-email" name="email" type="email" required className="input" />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="new-password">
                  Temporary password
                </label>
                <input
                  id="new-password"
                  name="password"
                  type="text"
                  required
                  minLength={10}
                  className="input font-mono"
                  placeholder="at least 10 characters"
                />
              </div>
              <div>
                <label className="label" htmlFor="new-role">
                  Role
                </label>
                <select
                  id="new-role"
                  name="roleId"
                  className="input"
                  value={createRoleId}
                  onChange={(event) => setCreateRoleId(event.target.value)}
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-admin btn-admin-primary" disabled={pending}>
                {pending ? "Creating…" : "Create account"}
              </button>
            </form>
          </div>
        </section>
      ) : null}

      <section className="card overflow-hidden">
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold text-ink-900">Invitations</h2>
          <span className="badge badge-gray">{invites.length}</span>
        </header>
        <ul className="divide-y divide-line">
          {invites.map((invite) => (
            <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
              <div>
                <p className="text-sm font-medium text-ink-900">{invite.email}</p>
                <p className="text-[11px] text-slate-400">
                  {invite.roleName} · invited by {invite.invitedByName ?? "system"} · expires {when(invite.expiresAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`badge ${
                    invite.status === "pending" && !invite.expired
                      ? "badge-amber"
                      : invite.status === "accepted"
                        ? "badge-green"
                        : "badge-gray"
                  }`}
                >
                  {invite.expired && invite.status === "pending" ? "expired" : invite.status}
                </span>
                {canManage && invite.status !== "accepted" ? (
                  <>
                    <button
                      type="button"
                      className="btn-admin btn-admin-secondary !px-2.5 !py-1 !text-[11px]"
                      disabled={pending}
                      onClick={() => run(() => resendInviteAction(invite.id))}
                    >
                      New link
                    </button>
                    {invite.status === "pending" ? (
                      <button
                        type="button"
                        className="text-[11px] text-slate-500 underline hover:text-red-600"
                        disabled={pending}
                        onClick={() => run(() => revokeInviteAction(invite.id))}
                      >
                        Revoke
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </li>
          ))}
          {invites.length === 0 ? (
            <li className="px-5 py-8 text-center text-sm text-slate-500">No invitations yet.</li>
          ) : null}
        </ul>
        {state?.inviteUrl ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-line bg-paper/60 px-5 py-3">
            <span className="text-[11px] text-slate-500">Invite link</span>
            <code className="break-all font-mono text-[11px] text-ink-900">{state.inviteUrl}</code>
            <CopyInline value={state.inviteUrl} />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function MemberRow({
  member,
  roles,
  canManage,
  isSelf,
  onResult,
  refresh,
}: {
  member: Member;
  roles: RoleRef[];
  canManage: boolean;
  isSelf: boolean;
  onResult: (state: Result) => void;
  refresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [banning, setBanning] = useState(false);
  const [selected, setSelected] = useState(member.role?.id ?? "");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<Result>, done?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      onResult(result);
      if (result.ok) {
        done?.();
        refresh();
      }
    });

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-900">
            {member.name}
            {isSelf ? <span className="badge badge-blue">you</span> : null}
            <span className={`badge ${member.banned ? "badge-red" : "badge-green"}`}>
              {member.banned ? "banned" : "active"}
            </span>
            {member.mustChangePassword ? <span className="badge badge-amber">password reset due</span> : null}
            {member.twoFactorEnabled ? <span className="badge badge-gray">2FA</span> : null}
            {member.passkeyCount > 0 ? (
              <span className="badge badge-gray">
                {member.passkeyCount} passkey{member.passkeyCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </p>
          <p className="text-[11px] text-slate-400">
            {member.email} · last sign-in {when(member.lastSignInAt)} · {member.sessionCount} live session
            {member.sessionCount === 1 ? "" : "s"}
            {member.banned && member.banReason ? ` · ${member.banReason}` : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {member.role ? (
              <span className={`badge ${member.role.isSystem ? "badge-blue" : "badge-gray"}`}>{member.role.name}</span>
            ) : (
              <span className="badge badge-red">no role</span>
            )}
          </div>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-admin btn-admin-secondary !px-2.5 !py-1 !text-[11px]"
              onClick={() => setEditing((value) => !value)}
            >
              {editing ? "Close" : "Change role"}
            </button>
            <button
              type="button"
              className="btn-admin btn-admin-secondary !px-2.5 !py-1 !text-[11px]"
              disabled={pending}
              onClick={() => run(() => resetUserPasswordAction({ userId: member.id }))}
            >
              Reset password
            </button>
            <button
              type="button"
              className="btn-admin btn-admin-secondary !px-2.5 !py-1 !text-[11px]"
              disabled={pending || member.sessionCount === 0}
              onClick={() => run(() => revokeAllUserSessionsAction({ userId: member.id }))}
            >
              End sessions
            </button>
            <button
              type="button"
              className="btn-admin btn-admin-secondary !px-2.5 !py-1 !text-[11px]"
              disabled={pending || isSelf || member.banned}
              onClick={() => run(() => impersonateMemberAction({ userId: member.id }))}
            >
              Sign in as
            </button>
            <button
              type="button"
              className={`text-[11px] underline ${
                member.banned ? "text-green-700" : "text-slate-500 hover:text-red-600"
              }`}
              disabled={pending || isSelf}
              onClick={() =>
                member.banned
                  ? run(() => unbanMemberAction({ userId: member.id }))
                  : setBanning((value) => !value)
              }
            >
              {member.banned ? "Lift ban" : banning ? "Cancel ban" : "Ban"}
            </button>
            <button
              type="button"
              className="text-[11px] text-slate-400 underline hover:text-red-700"
              disabled={pending || isSelf}
              onClick={() => run(() => removeMemberAction({ userId: member.id }))}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
      {editing && canManage ? (
        <form
          className="mt-3 rounded-lg border border-line bg-paper/60 p-3"
          action={() => run(() => setMemberRoleAction({ userId: member.id, roleId: selected }), () => setEditing(false))}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Role</p>
          <select className="input mt-2 max-w-xs" value={selected} onChange={(event) => setSelected(event.target.value)}>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name} · rank {role.rank}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[11px] text-slate-400">
            You cannot hand out a role at or above your own rank, and removing the last active admin is refused.
          </p>
          <button type="submit" className="btn-admin btn-admin-primary mt-2" disabled={pending}>
            {pending ? "Saving…" : "Save role"}
          </button>
        </form>
      ) : null}

      {banning && canManage && !member.banned ? (
        <form
          className="mt-3 rounded-lg border border-red-200 bg-red-50/60 p-3"
          action={() =>
            run(() => banMemberAction({ userId: member.id, reason }), () => {
              setBanning(false);
              setReason("");
            })
          }
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-red-700">Ban this account</p>
          <p className="mt-1 text-[11px] text-slate-600">
            Every session ends now and sign-in is refused until the ban is lifted. The reason is stored on the account.
          </p>
          <input
            className="input mt-2 max-w-md"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason, for example: left the company"
          />
          <button type="submit" className="btn-admin mt-2 bg-red-700 text-white" disabled={pending}>
            {pending ? "Banning…" : "Ban account"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
