"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeRoleAction, inviteStaffAction, resendInviteAction, revokeInviteAction, setUserStatusAction } from "@/lib/actions/team";
import type { ActionResult } from "./action";
import { CopyInline, Notice } from "./action";

type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  twoFactorEnabled: boolean;
  lastSignInAt: string | null;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  expired: boolean;
  invitedByName: string | null;
};

function when(value: string | null): string {
  if (!value) return "never";
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function TeamPanel({
  members,
  invites,
  currentUserId,
  canManage,
}: {
  members: Member[];
  invites: Invite[];
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await fn();
      setState(result);
      router.refresh();
    });

  return (
    <div className="space-y-5">
      <Notice state={state} />

      {canManage ? (
        <section className="panel">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-900">Invite staff</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Single-use link, seven-day window. There is no sign-up form — access only exists by invitation.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2 p-5">
            <div className="min-w-[240px] flex-1">
              <label className="label" htmlFor="invite-email">
                Email
              </label>
              <input
                id="invite-email"
                className="input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div>
              <label className="label" htmlFor="invite-role">
                Role
              </label>
              <select id="invite-role" className="select" value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              type="button"
              className="btn-admin btn-admin-primary"
              disabled={pending || !email.includes("@")}
              onClick={() =>
                run(async () => {
                  const result = await inviteStaffAction({ email, role: role as "admin" | "editor" | "viewer" });
                  if (result.ok) setEmail("");
                  return result;
                })
              }
            >
              {pending ? "Creating…" : "Create invitation"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">People</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Admins manage sites and staff, editors build and publish, viewers read only.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-paper/70 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Person</th>
                <th className="px-3 py-2.5 font-semibold">Role</th>
                <th className="px-3 py-2.5 font-semibold">2FA</th>
                <th className="px-3 py-2.5 font-semibold">Last sign-in</th>
                <th className="px-5 py-2.5 text-right font-semibold">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-ink-900">
                      {member.name}
                      {member.id === currentUserId ? <span className="ml-2 badge badge-blue">you</span> : null}
                    </p>
                    <p className="text-[11px] text-slate-400">{member.email}</p>
                  </td>
                  <td className="px-3 py-3">
                    {canManage && member.id !== currentUserId ? (
                      <select
                        className="select !py-1 !text-xs"
                        value={member.role}
                        disabled={pending}
                        onChange={(event) =>
                          run(() =>
                            changeRoleAction({
                              userId: member.id,
                              role: event.target.value as "admin" | "editor" | "viewer",
                            }),
                          )
                        }
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className="badge badge-gray">{member.role}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-[11px] text-slate-500">
                    {member.twoFactorEnabled ? "enabled" : "off"}
                  </td>
                  <td className="px-3 py-3 text-[11px] text-slate-500">{when(member.lastSignInAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`badge ${member.status === "active" ? "badge-green" : "badge-red"}`}>{member.status}</span>
                    {canManage && member.id !== currentUserId ? (
                      <button
                        type="button"
                        className="ml-2 text-[11px] text-slate-500 underline hover:text-ink-900"
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            setUserStatusAction({ userId: member.id, disabled: member.status === "active" }),
                          )
                        }
                      >
                        {member.status === "active" ? "Disable" : "Enable"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">Invitations</h2>
          <p className="mt-0.5 text-xs text-slate-500">Links are shown once at creation; re-issuing revokes the previous one.</p>
        </div>
        <ul className="divide-y divide-line">
          {invites.map((invite) => (
            <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink-900">{invite.email}</p>
                <p className="text-[11px] text-slate-400">
                  {invite.role} · invited by {invite.invitedByName ?? "system"} · expires {when(invite.expiresAt)}
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
                {canManage && invite.status === "pending" ? (
                  <>
                    <button
                      type="button"
                      className="btn-admin btn-admin-secondary !px-2.5 !py-1 !text-[11px]"
                      disabled={pending}
                      onClick={() => run(() => resendInviteAction(invite.id))}
                    >
                      New link
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-slate-500 underline hover:text-red-600"
                      disabled={pending}
                      onClick={() => run(() => revokeInviteAction(invite.id))}
                    >
                      Revoke
                    </button>
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
