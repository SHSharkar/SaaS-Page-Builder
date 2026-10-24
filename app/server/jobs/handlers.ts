import "server-only";
import { JOB_KINDS, type JobKind } from "@/lib/enums";
import { purgeRetiredMedia } from "@/app/server/media";
import { verifyPendingDomains } from "@/app/server/domains";
import { publishDuePages, unpublishDuePages } from "@/app/server/pages";
import { purgeErasedContacts } from "@/app/server/privacy";
import { purgeExpiredKeepWindows } from "@/app/server/sweeper";

export interface JobOutcome {
  readonly kind: JobKind;
  readonly handled: number;
  readonly detail: string;
}

export type JobHandler = (now: Date) => Promise<JobOutcome>;

async function handleScheduledPublish(now: Date): Promise<JobOutcome> {
  const due = await publishDuePages(now);
  return {
    kind: "page.scheduled-publish",
    handled: due.length,
    detail: "Published scheduled pages",
  };
}

async function handleScheduledUnpublish(now: Date): Promise<JobOutcome> {
  const due = await unpublishDuePages(now);
  return {
    kind: "page.scheduled-unpublish",
    handled: due.length,
    detail: "Unpublished scheduled pages",
  };
}

async function handleDomainVerify(): Promise<JobOutcome> {
  const result = await verifyPendingDomains();
  return {
    kind: "domain.verify",
    handled: result.checked,
    detail: `${result.verified} of ${result.checked} domains verified by DNS TXT record`,
  };
}

async function handleMediaOrphanSweep(now: Date): Promise<JobOutcome> {
  const purged = await purgeRetiredMedia(now);
  return {
    kind: "media.orphan-sweep",
    handled: purged.purged,
    detail: "Purged retired media rows past the retention window",
  };
}

async function handlePrivacyErasure(): Promise<JobOutcome> {
  const removed = await purgeErasedContacts();
  return {
    kind: "privacy.erasure",
    handled: removed.removed,
    detail: "Replayed the erasure log against stored contacts",
  };
}

async function handleDailySweep(now: Date): Promise<JobOutcome> {
  const counts = await purgeExpiredKeepWindows(now);
  return {
    kind: "sweeper.daily",
    handled:
      counts.purgedSites +
      counts.purgedPages +
      counts.purgedShortLinks +
      counts.purgedSessions,
    detail: `Sites ${counts.purgedSites}, pages ${counts.purgedPages}, short links ${counts.purgedShortLinks}, sessions ${counts.purgedSessions}`,
  };
}

export const JOB_HANDLERS: Readonly<Record<JobKind, JobHandler>> = {
  "page.scheduled-publish": handleScheduledPublish,
  "page.scheduled-unpublish": handleScheduledUnpublish,
  "domain.verify": handleDomainVerify,
  "media.orphan-sweep": handleMediaOrphanSweep,
  "privacy.erasure": handlePrivacyErasure,
  "sweeper.daily": handleDailySweep,
};

export function missingJobHandlers(): JobKind[] {
  return JOB_KINDS.filter((kind) => !JOB_HANDLERS[kind]);
}

export const JOB_SCHEDULES: readonly {
  readonly kind: JobKind;
  readonly cron: string;
}[] = [
  { kind: "page.scheduled-publish", cron: "* * * * *" },
  { kind: "page.scheduled-unpublish", cron: "* * * * *" },
  { kind: "domain.verify", cron: "*/15 * * * *" },
  { kind: "privacy.erasure", cron: "0 2 * * *" },
  { kind: "media.orphan-sweep", cron: "30 2 * * *" },
  { kind: "sweeper.daily", cron: "0 3 * * *" },
];
