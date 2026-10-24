"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRoleAction, deleteRoleAction, updateRoleAction } from "@/lib/actions/roles";
import type { PermissionDefinition, PermissionGroup } from "@/lib/auth/permissions";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import {
  adminBadgeVariants,
  adminButtonVariants,
  adminInputClass,
  adminLabelClass,
} from "@/lib/theme-classes";

type RoleItem = {
  id: string;
  key: string;
  name: string;
  description: string;
  rank: number;
  isSystem: boolean;
  permissionKeys: string[];
  memberCount: number;
  pendingInviteCount: number;
};

type GroupItem = {
  group: PermissionGroup;
  permissions: PermissionDefinition[];
};

export function RolesDesigner({
  roles,
  groups,
  actorRank,
  canManage,
}: {
  roles: RoleItem[];
  groups: GroupItem[];
  actorRank: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>(roles[0]?.id ?? "new");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const selected = useMemo(
    () => roles.find((role) => role.id === selectedId) ?? null,
    [roles, selectedId],
  );

  const [name, setName] = useState<string>(selected?.name ?? "");
  const [description, setDescription] = useState<string>(selected?.description ?? "");
  const [rank, setRank] = useState<number>(selected?.rank ?? 30);
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(selected?.permissionKeys ?? []),
  );

  const selectRole = (id: string) => {
    setSelectedId(id);
    setFeedback(null);
    if (id === "new") {
      setName("");
      setDescription("");
      setRank(Math.min(40, Math.max(5, actorRank - 10)));
      setChecked(new Set(["site.view", "page.view", "media.view", "template.view"]));
      return;
    }
    const next = roles.find((role) => role.id === id);
    if (!next) return;
    setName(next.name);
    setDescription(next.description);
    setRank(next.rank);
    setChecked(new Set(next.permissionKeys));
  };

  const creating = selectedId === "new";
  const isAdminRole = Boolean(selected?.isSystem && selected.key === "admin");
  const outranked = Boolean(selected && selected.rank > actorRank);
  const editable = canManage && !outranked;
  const permissionsEditable = editable && !isAdminRole;

  const toggle = (key: string) => {
    if (!permissionsEditable) return;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroup = (group: GroupItem, on: boolean) => {
    if (!permissionsEditable) return;
    setChecked((prev) => {
      const next = new Set(prev);
      for (const perm of group.permissions) {
        if (on) next.add(perm.key);
        else next.delete(perm.key);
      }
      return next;
    });
  };

  const save = () => {
    setFeedback(null);
    startTransition(async () => {
      const keys = Array.from(checked);
      const result = creating
        ? await createRoleAction({ name, description, rank, permissionKeys: keys })
        : selected
          ? await updateRoleAction({
              roleId: selected.id,
              name,
              description,
              rank,
              permissionKeys: keys,
            })
          : { ok: false, error: "Nothing selected." };

      if (!result.ok) {
        setFeedback({ ok: false, text: result.error ?? "Change refused." });
        return;
      }
      setFeedback({ ok: true, text: result.message ?? "Saved." });
      if (creating && result.roleId) setSelectedId(result.roleId);
      router.refresh();
    });
  };

  const remove = () => {
    if (!selected || selected.isSystem) return;
    setConfirmDeleteOpen(false);
    setFeedback(null);
    startTransition(async () => {
      const result = await deleteRoleAction({ roleId: selected.id });
      if (!result.ok) {
        setFeedback({ ok: false, text: result.error ?? "Could not delete role." });
        return;
      }
      const fallback = roles.find((role) => role.id !== selected.id)?.id ?? "new";
      selectRole(fallback);
      setFeedback({ ok: true, text: result.message ?? "Deleted." });
      router.refresh();
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <aside className="space-y-2 lg:col-span-4">
        <div className="rounded-xl border border-slate-200 bg-white p-2">
          {roles.map((role) => {
            const active = role.id === selectedId;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => selectRole(role.id)}
                className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                  active ? "bg-slate-950 text-white" : "hover:bg-slate-50 text-slate-900"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-words text-[13px] font-semibold">{role.name}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                        active
                          ? "bg-white/15 text-white/80"
                          : role.isSystem
                            ? "bg-slate-100 text-slate-600"
                            : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {role.isSystem ? "built-in" : "custom"}
                    </span>
                  </div>
                  <p
                    className={`mt-0.5 text-[11px] ${
                      active ? "text-white/65" : "text-slate-500"
                    }`}
                  >
                    {role.memberCount} member{role.memberCount === 1 ? "" : "s"} |{" "}
                    {role.permissionKeys.length} permission
                    {role.permissionKeys.length === 1 ? "" : "s"} | rank {role.rank}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {canManage ? (
          <button
            type="button"
            onClick={() => selectRole("new")}
            className={`w-full rounded-xl border border-dashed px-3 py-2.5 text-[13px] font-medium transition ${
              creating
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-300 bg-white/70 text-slate-700 hover:border-slate-500"
            }`}
          >
            + Design a custom role
          </button>
        ) : null}
      </aside>

      <div className="space-y-5 lg:col-span-8">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-600">
                {creating
                  ? "New custom role"
                  : selected?.isSystem
                    ? "Built-in role"
                    : "Custom role"}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">
                {creating ? name || "Untitled role" : selected?.name}
              </h2>
            </div>
            {selected && !creating ? (
              <span className={adminBadgeVariants({ tone: "gray" })}>key: {selected.key}</span>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className={adminLabelClass} htmlFor="role-name">
                Role name
              </label>
              <input
                id="role-name"
                className={adminInputClass}
                value={name}
                disabled={!editable || Boolean(selected?.isSystem)}
                onChange={(event) => setName(event.target.value)}
                placeholder="SEO Publisher"
              />
            </div>
            <div>
              <label className={adminLabelClass} htmlFor="role-rank">
                Seniority (1-99)
              </label>
              <input
                id="role-rank"
                type="number"
                min={1}
                max={Math.min(99, actorRank)}
                className={adminInputClass}
                value={rank}
                disabled={!editable || Boolean(selected?.isSystem)}
                onChange={(event) => setRank(Number(event.target.value) || 1)}
              />
            </div>
            <div className="sm:col-span-3">
              <label className={adminLabelClass} htmlFor="role-desc">
                What this role is for
              </label>
              <input
                id="role-desc"
                className={adminInputClass}
                value={description}
                disabled={!editable}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Publishes prepared campaigns and manages domain verification, without touching staff."
              />
            </div>
          </div>

          {isAdminRole ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Administrator holds every permission by design so the platform can never lock itself
              out. Duplicate the role below if you want a narrower senior role.
            </p>
          ) : null}
          {outranked ? (
            <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              This role sits above your own rank, so it is read-only for your account.
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Permissions</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Checked capabilities take effect immediately for every member holding this role.
              </p>
            </div>
            <span className="text-xs font-medium text-slate-600">{checked.size} selected</span>
          </div>

          <div className="divide-y divide-slate-200">
            {groups.map((group) => {
              const inGroup = group.permissions.filter((perm) => checked.has(perm.key)).length;
              const allOn = inGroup === group.permissions.length;
              return (
                <div key={group.group} className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                        {group.group}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {inGroup} of {group.permissions.length} granted
                      </p>
                    </div>
                    {permissionsEditable ? (
                      <button
                        type="button"
                        onClick={() => toggleGroup(group, !allOn)}
                        className="text-[11px] font-medium text-slate-600 underline hover:text-slate-950"
                      >
                        {allOn ? "Clear group" : "Select all"}
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.permissions.map((perm) => {
                      const on = checked.has(perm.key);
                      return (
                        <label
                          key={perm.key}
                          className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition ${
                            on ? "border-slate-900 bg-slate-900/[0.03]" : "border-slate-200"
                          } ${permissionsEditable ? "cursor-pointer" : "opacity-75"}`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 accent-slate-950"
                            checked={on}
                            disabled={!permissionsEditable}
                            onChange={() => toggle(perm.key)}
                          />
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-medium text-slate-900">
                              {perm.label}
                              {perm.sensitive ? (
                                <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[9.5px] font-semibold uppercase tracking-wider text-amber-800">
                                  elevated
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                              {perm.description}
                            </span>
                            <span className="mt-0.5 block font-mono text-[10px] text-slate-400">
                              {perm.key}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {editable ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={pending}
                  className={adminButtonVariants({ tone: "primary" })}
                >
                  {pending ? "Saving..." : creating ? "Create role" : "Save changes"}
                </button>
                {!creating && selected && !selected.isSystem ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOpen(true)}
                    disabled={pending}
                    className={adminButtonVariants({ tone: "danger" })}
                  >
                    Delete role
                  </button>
                ) : null}
              </div>
              {feedback ? (
                <p className={`text-xs ${feedback.ok ? "text-emerald-700" : "text-red-600"}`}>
                  {feedback.text}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      <ConfirmModal
        open={confirmDeleteOpen}
        title="Delete custom role"
        description={
          selected
            ? `Delete the "${selected.name}" role? This works only when nobody holds the role and no pending invitation points to it.`
            : ""
        }
        confirmLabel="Delete role"
        tone="danger"
        pending={pending}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={remove}
      />
    </div>
  );
}
