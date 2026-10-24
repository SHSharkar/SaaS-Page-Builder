
export type PermissionGroup = "content" | "sites" | "assets" | "access" | "platform";

export type PermissionDef = {
  key: string;
  group: PermissionGroup;
  label: string;
  description: string;

  dangerous?: boolean;
};

export const PERMISSION_GROUPS: { key: PermissionGroup; label: string; description: string }[] = [
  { key: "content", label: "Content", description: "Pages, global content and publishing" },
  { key: "sites", label: "Sites and domains", description: "Site lifecycle and hostnames" },
  { key: "assets", label: "Media, imports and templates", description: "Files, HTML imports and the template library" },
  { key: "access", label: "People and access", description: "Accounts, roles, sessions and invitations" },
  { key: "platform", label: "Platform", description: "Settings, audit, the queue and operations" },
];

export const PERMISSIONS: PermissionDef[] = [
  { key: "site.view", group: "sites", label: "View sites", description: "See the site list, counts and settings." },
  { key: "site.create", group: "sites", label: "Create sites", description: "Add a new site and its platform subdomain.", dangerous: true },
  { key: "site.update", group: "sites", label: "Edit site settings", description: "Rename a site and change its theme." },
  { key: "site.suspend", group: "sites", label: "Suspend or resume a site", description: "Stop serving a site without deleting it.", dangerous: true },
  { key: "site.delete", group: "sites", label: "Delete a site", description: "Take a site offline for the restore window.", dangerous: true },
  { key: "site.restore", group: "sites", label: "Restore a deleted site", description: "Bring a site back inside its restore window." },
  { key: "site.purge", group: "sites", label: "Purge a deleted site", description: "Hard-delete a site and everything it owns. Cannot be undone.", dangerous: true },
  { key: "domain.view", group: "sites", label: "View hostnames", description: "See a site's domains and their verification state." },
  { key: "domain.manage", group: "sites", label: "Manage hostnames", description: "Add, verify, retry and remove custom hostnames.", dangerous: true },

  { key: "page.view", group: "content", label: "View pages", description: "Read pages, drafts and version history." },
  { key: "page.create", group: "content", label: "Create pages", description: "Add a page from scratch, a template or a prompt." },
  { key: "page.edit", group: "content", label: "Edit page drafts", description: "Open the editor and save drafts." },
  { key: "page.publish", group: "content", label: "Publish pages", description: "Write a snapshot and put it live.", dangerous: true },
  { key: "page.schedule", group: "content", label: "Schedule publishing", description: "Queue a publish or a takedown for later." },
  { key: "page.archive", group: "content", label: "Archive pages", description: "Take a page out of serving and into the archive.", dangerous: true },
  { key: "page.restore", group: "content", label: "Restore archived pages", description: "Bring an archived page back as a draft." },
  { key: "globals.view", group: "content", label: "View global content", description: "See navigation, footer and default SEO." },
  { key: "globals.edit", group: "content", label: "Edit global content", description: "Change the site-wide header, footer and SEO defaults." },
  { key: "globals.publish", group: "content", label: "Publish global content", description: "Put global drafts live on every page.", dangerous: true },

  { key: "media.view", group: "assets", label: "View media", description: "Browse the media library and its usage." },
  { key: "media.upload", group: "assets", label: "Upload media", description: "Add images through the presigned upload flow." },
  { key: "media.delete", group: "assets", label: "Delete media", description: "Remove an unreferenced asset.", dangerous: true },
  { key: "import.view", group: "assets", label: "View imports", description: "See import jobs and their mapping results." },
  { key: "import.create", group: "assets", label: "Upload HTML imports", description: "Submit an HTML file for analysis." },
  { key: "import.review", group: "assets", label: "Review imports", description: "Accept, remap and apply an imported page." },
  { key: "template.view", group: "assets", label: "View templates", description: "See the curated and staff template library." },
  { key: "template.manage", group: "assets", label: "Manage templates", description: "Save, rename and retire templates." },

  { key: "staff.view", group: "access", label: "View staff accounts", description: "See accounts, their roles and their status." },
  { key: "staff.invite", group: "access", label: "Invite staff", description: "Issue a single-use invitation with a role attached." },
  { key: "staff.manage", group: "access", label: "Manage accounts", description: "Create accounts, suspend them, reset passwords and assign roles.", dangerous: true },
  { key: "role.view", group: "access", label: "View roles", description: "See roles and their permission matrix." },
  { key: "role.manage", group: "access", label: "Manage roles", description: "Create, edit and delete roles and their permissions.", dangerous: true },
  { key: "session.view", group: "access", label: "View sessions", description: "See who is signed in and from where." },
  { key: "session.revoke", group: "access", label: "Revoke sessions", description: "End another person's session immediately.", dangerous: true },

  { key: "settings.view", group: "platform", label: "View platform settings", description: "See settings, limits and the sweeper preview." },
  { key: "settings.manage", group: "platform", label: "Edit platform settings", description: "Change a platform setting, its limits and cache behaviour.", dangerous: true },
  { key: "audit.view", group: "platform", label: "View the audit log", description: "Read every recorded action." },
  { key: "catalog.view", group: "platform", label: "View the component catalogue", description: "See component definitions, fields and previews." },
  { key: "queue.run", group: "platform", label: "Run the queue", description: "Drain due jobs from the settings screen." },
  { key: "cleanup.run", group: "platform", label: "Run the sweeper", description: "Apply the keep windows by hand." },
];

export const PERMISSION_MAP = new Map(PERMISSIONS.map((permission) => [permission.key, permission]));
export const PERMISSION_KEYS = PERMISSIONS.map((permission) => permission.key);

export type SystemRoleKey = "admin" | "editor" | "viewer";

export type SystemRoleDef = {
  key: SystemRoleKey;
  name: string;
  description: string;
  rank: number;

  permissions: "*" | string[];
};

const EDITOR_PERMISSIONS = [
  "site.view",
  "domain.view",
  "page.view",
  "page.create",
  "page.edit",
  "page.publish",
  "page.schedule",
  "page.archive",
  "page.restore",
  "globals.view",
  "globals.edit",
  "globals.publish",
  "media.view",
  "media.upload",
  "import.view",
  "import.create",
  "import.review",
  "template.view",
  "template.manage",
  "session.view",
  "catalog.view",
];

const VIEWER_PERMISSIONS = [
  "site.view",
  "domain.view",
  "page.view",
  "globals.view",
  "media.view",
  "import.view",
  "template.view",
  "staff.view",
  "role.view",
  "session.view",
  "settings.view",
  "audit.view",
  "catalog.view",
];

export const SYSTEM_ROLES: SystemRoleDef[] = [
  {
    key: "admin",
    name: "Administrator",
    description: "Everything, including people, roles, sites and platform settings.",
    rank: 100,
    permissions: "*",
  },
  {
    key: "editor",
    name: "Editor",
    description: "Builds, imports and publishes pages and global content.",
    rank: 50,
    permissions: EDITOR_PERMISSIONS,
  },
  {
    key: "viewer",
    name: "Viewer",
    description: "Reads pages, history, media and the audit log. Changes nothing.",
    rank: 10,
    permissions: VIEWER_PERMISSIONS,
  },
];

export const SYSTEM_ROLE_KEYS = SYSTEM_ROLES.map((role) => role.key);

export function permissionsForRole(role: { permissions: "*" | string[] }): string[] {
  return role.permissions === "*" ? PERMISSION_KEYS : role.permissions.filter((key) => PERMISSION_MAP.has(key));
}

export function permissionLabel(key: string): string {
  return PERMISSION_MAP.get(key)?.label ?? key;
}

export function isKnownPermission(key: string): boolean {
  return PERMISSION_MAP.has(key);
}
