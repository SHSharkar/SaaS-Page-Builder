
import { LifecycleError, type LifecycleKind } from "./errors";

type Transitions = Record<string, string[]>;

const MACHINES: Record<LifecycleKind, Transitions> = {
  page: {
    draft: ["published", "archived"],
    published: ["published", "draft", "archived"],
    archived: ["draft"],
  },
  site: {
    active: ["suspended", "deleted"],
    suspended: ["active", "deleted"],
    deleted: ["active"],
  },
  domain: {
    pending: ["verifying", "active", "failed", "removed"],
    verifying: ["active", "failed", "removed"],
    active: ["removed"],
    failed: ["pending", "verifying", "removed"],
    removed: [],
  },
  import: {
    uploaded: ["parsing", "failed", "discarded"],
    parsing: ["mapped", "failed"],
    mapped: ["in_review", "applied", "failed", "discarded"],
    in_review: ["applied", "discarded", "failed"],
    applied: [],
    discarded: [],
    failed: [],
  },
  media: {
    pending: ["ready", "deleted"],
    ready: ["deleted"],
    deleted: [],
  },
  invite: {
    pending: ["accepted", "revoked", "expired"],
    accepted: [],
    revoked: [],
    expired: [],
  },
  template: {
    draft: ["active", "retired"],
    active: ["retired"],
    retired: [],
  },
  session: {
    active: ["expired"],
  },
};

export function canTransition(kind: LifecycleKind, from: string, to: string): boolean {
  if (from === to) return true;
  return (MACHINES[kind][from] ?? []).includes(to);
}

export function assertTransition(kind: LifecycleKind, from: string, to: string, message?: string): void {
  if (!canTransition(kind, from, to)) throw new LifecycleError(kind, from, to, message);
}

export function nextStates(kind: LifecycleKind, from: string): string[] {
  return MACHINES[kind][from] ?? [];
}

export const KEEP = {

  auditMonths: 24,

  versionsPerPage: 50,

  importJobDays: 90,

  importFileMonths: 12,

  pendingMediaHours: 24,

  siteRestoreDays: 30,

  removedDomainDays: 90,

  suspendedReviewMonths: 12,
} as const;

export function daysAgo(days: number, from = Date.now()): Date {
  return new Date(from - days * 24 * 60 * 60 * 1000);
}

export function monthsAgo(months: number, from = Date.now()): Date {
  const date = new Date(from);
  date.setMonth(date.getMonth() - months);
  return date;
}

export function hoursAgo(hours: number, from = Date.now()): Date {
  return new Date(from - hours * 60 * 60 * 1000);
}

export function daysFromNow(days: number, from = Date.now()): Date {
  return new Date(from + days * 24 * 60 * 60 * 1000);
}
