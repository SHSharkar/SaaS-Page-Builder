export interface PermissionSpec {
  readonly key: string;
  readonly group: string;
  readonly label: string;
  readonly description: string;
  readonly dangerous?: boolean;
}

export interface PermissionGroupSpec {
  readonly key: string;
  readonly label: string;
  readonly description: string;
}

export const PERMISSION_GROUPS: readonly PermissionGroupSpec[] = [
  { key: "sites", label: "Sites", description: "Properties, themes and their lifecycle." },
  { key: "pages", label: "Pages", description: "Drafting, publishing, snapshots and the homepage." },
  { key: "globals", label: "Global content", description: "Site-wide navigation, footer and default tags." },
  { key: "media", label: "Media", description: "Uploads, alt text and deletions." },
  { key: "domains", label: "Domains", description: "Hostnames, DNS checks and primary routing." },
  { key: "templates", label: "Templates", description: "Applying, saving and retiring templates." },
  { key: "imports", label: "Imports", description: "HTML analysis, human review and draft creation." },
  { key: "catalog", label: "Components", description: "Browsing the code-owned component registry." },
  { key: "people", label: "Team & roles", description: "Accounts, invitations, sessions and permissions." },
  { key: "platform", label: "Platform", description: "Audit log, settings, worker and cleanup." },
] as const;

export const PERMISSIONS: readonly PermissionSpec[] = [
  { key: "site.view", group: "sites", label: "View sites", description: "List sites and read their overview." },
  { key: "site.create", group: "sites", label: "Create sites", description: "Spin up a new site with its subdomain and defaults." },
  { key: "site.update", group: "sites", label: "Edit site identity & theme", description: "Rename a site and change its color, font and logo tokens." },
  { key: "site.suspend", group: "sites", label: "Suspend or resume sites", description: "Take every hostname of a site offline, or bring it back.", dangerous: true },
  { key: "site.delete", group: "sites", label: "Delete sites", description: "Mark a site deleted and start its restore window.", dangerous: true },
  { key: "site.restore", group: "sites", label: "Restore deleted sites", description: "Bring a deleted site back inside its restore window." },
  { key: "site.purge", group: "sites", label: "Purge deleted sites", description: "Destroy a deleted site, its snapshots and its stored files immediately.", dangerous: true },

  { key: "page.view", group: "pages", label: "View pages & history", description: "Read drafts, version history and settings." },
  { key: "page.preview", group: "pages", label: "Open staff previews", description: "Render unpublished drafts on the noindex preview route." },
  { key: "page.create", group: "pages", label: "Create pages", description: "Add a blank or template-seeded draft page." },
  { key: "page.edit", group: "pages", label: "Edit drafts & page settings", description: "Save block trees, titles, slugs and SEO tags." },
  { key: "page.publish", group: "pages", label: "Publish & unpublish pages", description: "Write immutable snapshots and clear the public cache." },
  { key: "page.schedule", group: "pages", label: "Schedule publication", description: "Queue a timed publish or unpublish on the worker." },
  { key: "page.rollback", group: "pages", label: "Roll back to an earlier version", description: "Republish a historical snapshot as a new version." },
  { key: "page.homepage", group: "pages", label: "Set the site homepage", description: "Move the homepage pointer between pages of a site." },
  { key: "page.archive", group: "pages", label: "Archive & restore pages", description: "Take a page out of service without losing its snapshots." },

  { key: "globals.view", group: "globals", label: "View global content", description: "Inspect the site header, footer and default tags." },
  { key: "globals.edit", group: "globals", label: "Edit global drafts", description: "Change navigation, footer or default SEO drafts." },
  { key: "globals.publish", group: "globals", label: "Publish global content", description: "Push global changes live and invalidate the site cache." },

  { key: "media.view", group: "media", label: "Browse media library", description: "List and inspect uploaded assets." },
  { key: "media.upload", group: "media", label: "Upload media", description: "Presign, upload and confirm verified image files." },
  { key: "media.update", group: "media", label: "Edit media metadata", description: "Update alt text and captions." },
  { key: "media.delete", group: "media", label: "Delete unreferenced media", description: "Remove an image when no page, snapshot or theme uses it." },

  { key: "domain.view", group: "domains", label: "View domains", description: "See connected hostnames, DNS instructions and certificate state." },
  { key: "domain.manage", group: "domains", label: "Connect & disconnect domains", description: "Add hostnames, make one primary or disconnect it.", dangerous: true },
  { key: "domain.verify", group: "domains", label: "Run DNS verification", description: "Trigger a TXT check or reopen a failed window." },

  { key: "template.view", group: "templates", label: "Browse templates", description: "Inspect curated and team-saved templates." },
  { key: "template.apply", group: "templates", label: "Apply templates", description: "Create a draft page from a template and fill its placeholders." },
  { key: "template.create", group: "templates", label: "Save a page as a template", description: "Turn a draft into a reusable staff template." },
  { key: "template.manage", group: "templates", label: "Manage platform templates", description: "Retire any template, including curated ones.", dangerous: true },

  { key: "import.view", group: "imports", label: "View import jobs", description: "Read HTML analyses and past import decisions." },
  { key: "import.create", group: "imports", label: "Upload HTML for analysis", description: "Submit markup for section detection and mapping." },
  { key: "import.apply", group: "imports", label: "Approve or discard imports", description: "Turn reviewed sections into a draft page, or discard the job." },

  { key: "catalog.view", group: "catalog", label: "Browse component library", description: "Inspect schemas, defaults and live previews of every block." },
  { key: "catalog.admin_blocks", group: "catalog", label: "Use raw HTML and iframe embeds", description: "Insert or edit administrator-only raw HTML and generic iframe embed blocks.", dangerous: true },

  { key: "staff.view", group: "people", label: "View team & sessions", description: "See staff accounts, invitations and active sessions." },
  { key: "staff.invite", group: "people", label: "Invite staff", description: "Issue, resend and revoke single-use invitation links.", dangerous: true },
  { key: "staff.manage", group: "people", label: "Manage staff accounts", description: "Create accounts, assign roles, ban or lift bans, force password resets and end sessions.", dangerous: true },
  { key: "role.view", group: "people", label: "View roles & permission matrix", description: "Inspect every role and the permissions it grants." },
  { key: "role.manage", group: "people", label: "Create & edit roles", description: "Create custom roles and change which permissions each role holds.", dangerous: true },

  { key: "audit.view", group: "platform", label: "Read the audit log", description: "Filter and inspect the append-only compliance trail." },
  { key: "settings.view", group: "platform", label: "View platform settings", description: "Inspect runtime knobs, keep windows and the job queue." },
  { key: "settings.manage", group: "platform", label: "Change platform settings", description: "Write runtime settings in the database.", dangerous: true },
  { key: "ops.run", group: "platform", label: "Run worker ticks, sweeps & cache clears", description: "Trigger the queue, the daily sweeper or a full cache flush by hand.", dangerous: true },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const PERMISSION_KEYS: readonly string[] = PERMISSIONS.map((permission) => permission.key);

export const PERMISSION_BY_KEY: ReadonlyMap<string, PermissionSpec> = new Map(
  PERMISSIONS.map((permission) => [permission.key, permission]),
);

export interface SystemRoleSeed {
  readonly key: "admin" | "editor" | "viewer";
  readonly name: string;
  readonly description: string;
  readonly rank: number;
  readonly permissions: readonly string[] | "*";
}

export const SYSTEM_ROLES: readonly SystemRoleSeed[] = [
  {
    key: "admin",
    name: "Administrator",
    description: "Unrestricted control over people, roles, domains, raw HTML blocks, sites and runtime settings.",
    rank: 100,
    permissions: "*",
  },
  {
    key: "editor",
    name: "Editor",
    description: "Creates sites, drafts and publishes pages and globals, manages media, templates and imports.",
    rank: 50,
    permissions: [
      "site.view",
      "site.create",
      "site.update",
      "page.view",
      "page.preview",
      "page.create",
      "page.edit",
      "page.publish",
      "page.schedule",
      "page.rollback",
      "page.homepage",
      "page.archive",
      "globals.view",
      "globals.edit",
      "globals.publish",
      "media.view",
      "media.upload",
      "media.update",
      "media.delete",
      "domain.view",
      "domain.verify",
      "template.view",
      "template.apply",
      "template.create",
      "import.view",
      "import.create",
      "import.apply",
      "catalog.view",
    ],
  },
  {
    key: "viewer",
    name: "Viewer",
    description: "Read-only access to sites, pages, previews, templates, media and the component catalog.",
    rank: 10,
    permissions: [
      "site.view",
      "page.view",
      "page.preview",
      "globals.view",
      "media.view",
      "domain.view",
      "template.view",
      "import.view",
      "catalog.view",
    ],
  },
] as const;

export interface PermissionSubject {
  permissions: Set<PermissionKey | string>;
  roles?: ReadonlyArray<{ key: string; rank: number }>;
  roleRank?: number;
}

export function can(actor: PermissionSubject | null | undefined, perm: PermissionKey): boolean {
  if (!actor) return false;
  if (actor.roles?.some((r) => r.key === "admin" || r.rank >= 100)) return true;
  if (typeof actor.roleRank === "number" && actor.roleRank >= 100) return true;
  return actor.permissions.has(perm);
}

export function highestRank(actor: PermissionSubject | null | undefined): number {
  if (!actor) return 0;
  if (actor.roles && actor.roles.length > 0) {
    return actor.roles.reduce((max, r) => Math.max(max, r.rank), 0);
  }
  return actor.roleRank ?? 0;
}

export function isAdminRank(actor: PermissionSubject | null | undefined): boolean {
  return highestRank(actor) >= 100;
}

export type PermissionDefinition = PermissionSpec & { sensitive?: boolean };
export type PermissionGroup = (typeof PERMISSION_GROUPS)[number]["key"];

export function permissionsByGroup(): Array<{
  group: PermissionGroup;
  label: string;
  items: PermissionDefinition[];
  permissions: PermissionDefinition[];
}> {
  return PERMISSION_GROUPS.map((g) => {
    const list = PERMISSIONS.filter((p) => p.group === g.key).map((p) => ({
      ...p,
      sensitive: p.dangerous,
    }));
    return {
      group: g.key,
      label: g.label,
      items: list,
      permissions: list,
    };
  });
}


