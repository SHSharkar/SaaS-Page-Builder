"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRoleAction, deleteRoleAction, updateRoleAction } from "@/lib/actions/roles";
import { Notice } from "./action";

type RoleRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  rank: number;
  isSystem: boolean;
  memberCount: number;
  permissionCount: number;
};

type PermissionRow = {
  key: string;
  group: string;
  label: string;
  description: string;
  dangerous: boolean;
};

type Result = { ok: boolean; error?: string; message?: string };
type Feedback = Result | null;

export function RolesPanel({
  roles,
  grants,
  groups,
  permissions,
  canManage,
  currentRoleKeys,
}: {
  roles: RoleRow[];
  grants: Record<string, string[]>;
  groups: { key: string; label: string; description: string }[];
  permissions: PermissionRow[];
  canManage: boolean;
  currentRoleKeys: string[];
}) {
  const router = useRouter();
  const [selectedRoleId, setSelectedRoleId] = useState(roles[0]?.id ?? "");
  const [creating, setCreating] = useState(false);
  const [state, setState] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();

  const role = roles.find((candidate) => candidate.id === selectedRoleId) ?? roles[0];
  const granted = useMemo(() => new Set(role ? grants[role.id] ?? [] : []), [grants, role]);
  const isAdminRole = role?.key === "admin";
  const locked = !canManage || isAdminRole;

  const run = (fn: () => Promise<Result>) =>
    startTransition(async () => {
      const result = await fn();
      setState(result);
      if (result.ok) router.refresh();
    });

  return (
    <div className="grid gap-5 xl:grid-cols-[260px_1fr]">
      <aside className="space-y-3">
        <div className="card overflow-hidden">
          <p className="border-b border-line px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Roles
          </p>
          <ul className="divide-y divide-line">
            {roles.map((candidate) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRoleId(candidate.id);
                    setCreating(false);
                    setState(null);
                  }}
                  className={`flex w-full items-start justify-between gap-2 px-4 py-2.5 text-left text-[12px] transition ${
                    candidate.id === role?.id ? "bg-paper font-semibold text-ink-900" : "text-slate-600 hover:bg-paper/60"
                  }`}
                >
                  <span>
                    {candidate.name}
                    <span className="block text-[10px] font-normal text-slate-400">
                      {candidate.memberCount} member{candidate.memberCount === 1 ? "" : "s"} ·{" "}
                      {candidate.permissionCount} grants
                    </span>
                  </span>
                  {candidate.isSystem ? <span className="badge badge-blue">system</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {canManage ? (
          <button
            type="button"
            className="btn-admin btn-admin-secondary w-full"
            onClick={() => {
              setCreating(true);
              setState(null);
            }}
          >
            + New role
          </button>
        ) : null}

        <div className="rounded-lg border border-line bg-paper/60 p-3 text-[11px] leading-relaxed text-slate-500">
          Administrator always holds every permission, including keys added by a later deploy, and cannot be
          narrowed. Editor and Viewer are seeded once and are editable afterwards.
        </div>
      </aside>

      <section className="min-w-0 space-y-4">
        <Notice state={state} />

        {creating && canManage ? (
          <CreateRoleForm
            groups={groups}
            permissions={permissions}
            pending={pending}
            onCancel={() => setCreating(false)}
            onCreate={(input) =>
              run(async () => {
                const result = await createRoleAction(input);
                if (result.ok && result.roleId) {
                  setSelectedRoleId(result.roleId);
                  setCreating(false);
                }
                return result;
              })
            }
          />
        ) : null}

        {role ? (
          <RoleEditor
            key={role.id}
            role={role}
            groups={groups}
            permissions={permissions}
            granted={granted}
            locked={locked}
            pending={pending}
            canDelete={canManage && !role.isSystem && role.memberCount === 0}
            onSave={(input) =>
              run(() =>
                updateRoleAction({
                  roleId: role.id,
                  name: input.name,
                  description: input.description,
                  rank: role.isSystem ? role.rank : input.rank,
                  permissionKeys: input.permissionKeys,
                }),
              )
            }
            onDelete={() =>
              run(async () => {
                const result = await deleteRoleAction({ roleId: role.id });
                if (result.ok) setSelectedRoleId(roles.find((row) => row.id !== role.id)?.id ?? "");
                return result;
              })
            }
            selfHoldsRole={currentRoleKeys.includes(role.key)}
          />
        ) : (
          <p className="card p-5 text-sm text-slate-500">No roles yet.</p>
        )}
      </section>
    </div>
  );
}

function RoleEditor({
  role,
  groups,
  permissions,
  granted,
  locked,
  pending,
  canDelete,
  onSave,
  onDelete,
  selfHoldsRole,
}: {
  role: RoleRow;
  groups: { key: string; label: string; description: string }[];
  permissions: PermissionRow[];
  granted: Set<string>;
  locked: boolean;
  pending: boolean;
  canDelete: boolean;
  onSave: (input: { name: string; description: string; rank: number; permissionKeys: string[] }) => void;
  onDelete: () => void;
  selfHoldsRole: boolean;
}) {
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description);
  const [rank, setRank] = useState(role.rank);
  const [keys, setKeys] = useState<string[]>([...granted]);
  const [confirming, setConfirming] = useState(false);

  const toggle = (key: string) =>
    setKeys((current) => (current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]));
  const toggleGroup = (groupKey: string, on: boolean) => {
    const groupKeys = permissions.filter((permission) => permission.group === groupKey).map((permission) => permission.key);
    setKeys((current) => (on ? [...new Set([...current, ...groupKeys])] : current.filter((key) => !groupKeys.includes(key))));
  };

  return (
    <div className="card overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-ink-900">
            {role.name} <span className="font-mono text-[11px] font-normal text-slate-400">{role.key}</span>
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {role.memberCount} member{role.memberCount === 1 ? "" : "s"} · {keys.length} of {permissions.length}{" "}
            permissions {role.isSystem ? "· key and rank fixed by the definition" : ""}
          </p>
        </div>
        <span className={`badge ${role.rank >= 100 ? "badge-blue" : role.rank >= 50 ? "badge-green" : "badge-gray"}`}>
          rank {role.rank}
        </span>
      </header>

      <div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_120px]">
          <div>
            <label className="label" htmlFor="role-name">
              Name
            </label>
            <input
              id="role-name"
              className="input"
              value={name}
              disabled={locked || role.isSystem}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="role-description">
              Description
            </label>
            <input
              id="role-description"
              className="input"
              value={description}
              disabled={locked && !role.isSystem}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="role-rank">
              Rank
            </label>
            <input
              id="role-rank"
              type="number"
              min={0}
              max={99}
              className="input"
              value={rank}
              disabled={locked || role.isSystem}
              onChange={(event) => setRank(Number(event.target.value))}
            />
          </div>
        </div>

        <div className="space-y-3">
          {groups.map((group) => {
            const rows = permissions.filter((permission) => permission.group === group.key);
            const onCount = rows.filter((row) => keys.includes(row.key)).length;
            return (
              <fieldset key={group.key} className="rounded-lg border border-line">
                <legend className="ml-3 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {group.label}
                  <span className="font-normal normal-case tracking-normal text-slate-400">
                    {onCount}/{rows.length}
                  </span>
                  {!locked ? (
                    <span className="flex gap-2 font-normal normal-case tracking-normal">
                      <button
                        type="button"
                        className="text-[10px] text-slate-500 underline hover:text-ink-900"
                        onClick={() => toggleGroup(group.key, true)}
                      >
                        all
                      </button>
                      <button
                        type="button"
                        className="text-[10px] text-slate-500 underline hover:text-ink-900"
                        onClick={() => toggleGroup(group.key, false)}
                      >
                        none
                      </button>
                    </span>
                  ) : null}
                </legend>
                <div className="grid gap-1.5 p-3 sm:grid-cols-2">
                  {rows.map((permission) => (
                    <label
                      key={permission.key}
                      className={`flex items-start gap-2 rounded-md border px-2 py-1.5 text-[11px] ${
                        keys.includes(permission.key)
                          ? "border-ink-900/15 bg-paper"
                          : "border-transparent hover:bg-paper/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={keys.includes(permission.key)}
                        disabled={locked}
                        onChange={() => toggle(permission.key)}
                      />
                      <span>
                        <span className={`font-medium ${permission.dangerous ? "text-red-700" : "text-ink-900"}`}>
                          {permission.label}
                        </span>
                        <span className="block text-[10px] leading-snug text-slate-500">{permission.description}</span>
                        <span className="font-mono text-[10px] text-slate-400">{permission.key}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <button
            type="button"
            className="btn-admin btn-admin-primary"
            disabled={locked || pending}
            onClick={() => onSave({ name, description, rank, permissionKeys: keys })}
          >
            {pending ? "Saving…" : "Save role"}
          </button>
          <button
            type="button"
            className="btn-admin btn-admin-secondary"
            disabled={pending}
            onClick={() => setKeys([...granted])}
          >
            Reset changes
          </button>
          {canDelete ? (
            confirming ? (
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-[11px] font-semibold text-red-600 underline"
                  disabled={pending}
                  onClick={onDelete}
                >
                  Yes, delete {role.name}
                </button>
                <button type="button" className="text-[11px] text-slate-500 underline" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="text-[11px] text-slate-500 underline hover:text-red-600"
                onClick={() => setConfirming(true)}
              >
                Delete role
              </button>
            )
          ) : null}
          {selfHoldsRole ? (
            <span className="text-[11px] text-amber-700">
              You hold this role — tightening it changes your own access on the next request.
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CreateRoleForm({
  groups,
  permissions,
  pending,
  onCancel,
  onCreate,
}: {
  groups: { key: string; label: string; description: string }[];
  permissions: PermissionRow[];
  pending: boolean;
  onCancel: () => void;
  onCreate: (input: { name: string; description: string; rank: number; permissionKeys: string[] }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rank, setRank] = useState(0);
  const [templateOf, setTemplateOf] = useState("editor");

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-ink-900">New role</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="new-role-name">
            Name
          </label>
          <input
            id="new-role-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Marketing editor"
          />
        </div>
        <div>
          <label className="label" htmlFor="new-role-description">
            Description
          </label>
          <input
            id="new-role-description"
            className="input"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What this role is for"
          />
        </div>
      </div>
      <div className="mt-3 max-w-[220px]">
        <label className="label" htmlFor="new-role-rank">
          Rank
        </label>
        <input
          id="new-role-rank"
          type="number"
          min={0}
          max={99}
          className="input"
          value={rank}
          onChange={(event) => setRank(Number(event.target.value))}
        />
        <p className="mt-1 text-[11px] text-slate-400">
          Nobody can manage a role ranked at or above their own. Administrator is 100.
        </p>
      </div>
      <div className="mt-3">
        <span className="label">Start from</span>
        <div className="flex flex-wrap gap-2">
          {[{ key: "none", label: "Nothing" }, ...groups.map((group) => ({ key: group.key, label: group.label }))].map(
            (option) => (
              <label
                key={option.key}
                className="flex items-center gap-1.5 rounded-md border border-line bg-white px-2 py-1 text-[11px]"
              >
                <input
                  type="radio"
                  name="templateOf"
                  value={option.key}
                  checked={templateOf === option.key}
                  onChange={() => setTemplateOf(option.key)}
                />
                {option.label}
              </label>
            ),
          )}
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          The role is created with the permissions of that group; tune the matrix afterwards.
        </p>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="btn-admin btn-admin-primary"
          disabled={pending || name.trim().length < 2}
          onClick={() =>
            onCreate({
              name,
              description,
              rank: Number.isFinite(rank) ? Math.max(0, Math.min(99, rank)) : 0,
              permissionKeys:
                templateOf === "none"
                  ? []
                  : permissions.filter((permission) => permission.group === templateOf).map((p) => p.key),
            })
          }
        >
          {pending ? "Creating…" : "Create role"}
        </button>
        <button type="button" className="btn-admin btn-admin-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
