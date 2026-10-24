import "server-only";
import type {
  DomainStatus,
  ImportStatus,
  InviteStatus,
  MediaStatus,
  PageStatus,
  SiteStatus,
  TemplateStatus,
} from "@/lib/enums";

export const KEEP_WINDOWS_DAYS = {
  siteTrash: 30,
  pageTrash: 30,
  importHistory: 14,
  auditTrail: 365,
} as const;

const TRANSITIONS: Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
> = {
  site: {
    active: ["suspended", "deleted"],
    suspended: ["active", "deleted"],
    deleted: ["active"],
  },
  page: {
    draft: ["published", "archived", "deleted"],
    published: ["draft", "archived", "deleted"],
    archived: ["draft", "deleted"],
    deleted: ["draft"],
  },
  domain: {
    pending: ["verifying", "active", "failed", "removed"],
    verifying: ["active", "failed", "removed"],
    active: ["removed", "failed"],
    failed: ["verifying", "removed"],
    removed: [],
  },
  import: {
    uploaded: ["parsing", "mapped", "failed", "discarded"],
    parsing: ["mapped", "failed", "discarded"],
    mapped: ["in_review", "applied", "discarded"],
    in_review: ["applied", "discarded"],
    applied: [],
    failed: ["discarded"],
    discarded: [],
  },
  media: {
    pending: ["ready", "failed", "deleted"],
    ready: ["deleted"],
    failed: ["deleted"],
    deleted: [],
  },
  invite: {
    pending: ["accepted", "revoked", "expired"],
    accepted: [],
    revoked: [],
    expired: [],
  },
  template: {
    active: ["retired"],
    retired: ["active"],
  },
};

export type LifecycleEntity =
  "site" | "page" | "domain" | "import" | "media" | "invite" | "template";

type AnyLifecycleStatus =
  | SiteStatus
  | PageStatus
  | DomainStatus
  | ImportStatus
  | MediaStatus
  | InviteStatus
  | TemplateStatus;
void (null as unknown as AnyLifecycleStatus);

export function canTransition(
  entity: LifecycleEntity,
  fromStatus: string,
  toStatus: string,
): boolean {
  const allowed = TRANSITIONS[entity]?.[fromStatus];
  return Boolean(allowed?.includes(toStatus));
}

export function assertTransition(
  entity: LifecycleEntity,
  fromStatus: string,
  toStatus: string,
): void {
  if (!canTransition(entity, fromStatus, toStatus)) {
    throw new Error(
      `Invalid ${entity} transition from "${fromStatus}" to "${toStatus}"`,
    );
  }
}
