/**
 * The state machines and keep windows of PRD 3.5 and 3.6, in one place.
 *
 * Every state change in the product goes through `assertTransition`, so an
 * illegal move is a typed refusal (HTTP 409 with the same message on screen)
 * rather than a silent write that leaves a record in a shape the rest of the
 * system does not expect.
 */
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

/* ------------------------------------------------------------------ *
 * Keep windows (PRD 3.6). One sweeper owns all of them.
 * ------------------------------------------------------------------ */

export const KEEP = {
  /** Append-only audit rows are retained for two years, then dropped. */
  auditMonths: 24,
  /** Immutable snapshots per page. Rollback older than this is not offered. */
  versionsPerPage: 50,
  /** Import jobs are kept for ninety days so reviewers can look back. */
  importJobDays: 90,
  /** The uploaded HTML itself is kept as a private attachment for a year. */
  importFileMonths: 12,
  /** A pending upload that never confirms is swept after a day. */
  pendingMediaHours: 24,
  /** A deleted site stays restorable for thirty days, then is purged. */
  siteRestoreDays: 30,
  /** A removed hostname keeps its row for a quarter, then is forgotten. */
  removedDomainDays: 90,
  /** Suspended sites are reviewed after a year of inactivity. */
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
