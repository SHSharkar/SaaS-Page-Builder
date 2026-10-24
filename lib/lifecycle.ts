import { LifecycleError } from "./errors";

export type ManagedEntity =
  | "site"
  | "page"
  | "domain"
  | "import"
  | "media"
  | "invite"
  | "template";

const TRANSITIONS: Record<ManagedEntity, Record<string, readonly string[]>> = {
  site: {
    active: ["active", "suspended", "deleted"],
    suspended: ["suspended", "active", "deleted"],
    deleted: ["active"],
  },
  page: {
    draft: ["draft", "published", "archived", "deleted"],
    published: ["published", "draft", "archived", "deleted"],
    archived: ["draft"],
    deleted: ["draft"],
  },
  domain: {
    pending: ["pending", "verifying", "active", "failed", "removed"],
    verifying: ["verifying", "active", "failed", "removed"],
    active: ["active", "failed", "removed"],
    failed: ["pending", "verifying", "removed"],
    removed: [],
  },
  import: {
    uploaded: ["parsing", "failed", "discarded"],
    parsing: ["mapped", "review", "in_review", "failed", "discarded"],
    mapped: ["review", "in_review", "applied", "discarded"],
    review: ["review", "in_review", "applied", "discarded"],
    in_review: ["in_review", "applied", "discarded"],
    applied: [],
    failed: ["discarded"],
    discarded: [],
  },
  media: {
    pending: ["ready", "failed", "deleted"],
    ready: ["ready", "deleted"],
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
    active: ["active", "retired"],
    retired: [],
  },
};

export function canTransition(entity: ManagedEntity, from: string, to: string): boolean {
  const allowed = TRANSITIONS[entity]?.[from];
  return Boolean(allowed?.includes(to));
}

export function assertTransition(
  entity: ManagedEntity,
  from: string,
  to: string,
  reason?: string,
): void {
  if (!canTransition(entity, from, to)) {
    throw new LifecycleError(entity, from, to, reason);
  }
}

export function nextStates(entity: ManagedEntity, from: string): readonly string[] {
  return TRANSITIONS[entity]?.[from] ?? [];
}

export const KEEP = {
  auditMonths: 24,
  versionsPerPage: 50,
  pageVersionsPerPage: 50,
  importJobDays: 90,
  importFileMonths: 12,
  inviteHistoryDays: 90,
  pendingMediaHours: 24,
  siteRestoreDays: 30,
  pageTrashDays: 30,
  removedDomainDays: 90,
  suspendedReviewMonths: 6,
} as const;

export function daysAgo(days: number, from = Date.now()): Date {
  return new Date(from - days * 86_400_000);
}

export function daysFromNow(days: number, from = Date.now()): Date {
  return new Date(from + days * 86_400_000);
}

export function hoursAgo(hours: number, from = Date.now()): Date {
  return new Date(from - hours * 3_600_000);
}

export function monthsAgo(months: number, from = Date.now()): Date {
  const date = new Date(from);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date;
}
