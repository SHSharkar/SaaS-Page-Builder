import "server-only";
import { PgBoss } from "pg-boss";
import { JOB_KINDS, type JobKind } from "@/lib/enums";
import { JOB_SCHEDULES } from "./handlers";
import { getEnv } from "@/app/server/env";
import { logger } from "@/app/server/logger";

export interface QueuePolicyConfig {
  readonly name: JobKind;
  readonly deadLetter: `${JobKind}.dlq`;
  readonly retryLimit: number;
  readonly retryDelay: number;
  readonly retryBackoff: boolean;
  readonly expireInSeconds: number;
  readonly retentionSeconds: number;
}

export const QUEUE_POLICY_MAP: Readonly<Record<JobKind, QueuePolicyConfig>> = {
  "page.scheduled-publish": {
    name: "page.scheduled-publish",
    deadLetter: "page.scheduled-publish.dlq",
    retryLimit: 5,
    retryDelay: 15,
    retryBackoff: true,
    expireInSeconds: 120,
    retentionSeconds: 7 * 86_400,
  },
  "page.scheduled-unpublish": {
    name: "page.scheduled-unpublish",
    deadLetter: "page.scheduled-unpublish.dlq",
    retryLimit: 5,
    retryDelay: 15,
    retryBackoff: true,
    expireInSeconds: 120,
    retentionSeconds: 7 * 86_400,
  },
  "domain.verify": {
    name: "domain.verify",
    deadLetter: "domain.verify.dlq",
    retryLimit: 6,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 120,
    retentionSeconds: 7 * 86_400,
  },
  "media.orphan-sweep": {
    name: "media.orphan-sweep",
    deadLetter: "media.orphan-sweep.dlq",
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 300,
    retentionSeconds: 7 * 86_400,
  },
  "privacy.erasure": {
    name: "privacy.erasure",
    deadLetter: "privacy.erasure.dlq",
    retryLimit: 5,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 180,
    retentionSeconds: 14 * 86_400,
  },
  "sweeper.daily": {
    name: "sweeper.daily",
    deadLetter: "sweeper.daily.dlq",
    retryLimit: 3,
    retryDelay: 120,
    retryBackoff: true,
    expireInSeconds: 600,
    retentionSeconds: 14 * 86_400,
  },
};

export async function createConfiguredPgBoss(): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString: getEnv().DATABASE_URL,
    schema: "pgboss",
    application_name: "saas-page-builder-worker",
  });
  boss.on("error", (err) => {
    logger.error({ err: err.message }, "pg-boss error");
  });
  await boss.start();

  for (const kind of JOB_KINDS) {
    const policy = QUEUE_POLICY_MAP[kind];
    await boss.createQueue(policy.deadLetter, {
      policy: "standard",
      retentionSeconds: 30 * 86_400,
    });
    await boss.createQueue(policy.name, {
      policy: "standard",
      deadLetter: policy.deadLetter,
      retryLimit: policy.retryLimit,
      retryDelay: policy.retryDelay,
      retryBackoff: policy.retryBackoff,
      expireInSeconds: policy.expireInSeconds,
      retentionSeconds: policy.retentionSeconds,
    });
  }
  return boss;
}

export async function ensureScheduledJobs(boss: PgBoss): Promise<void> {
  for (const schedule of JOB_SCHEDULES) {
    await boss.schedule(schedule.kind, schedule.cron, { source: "schedule" });
  }
}

export async function enqueueRunOnceJob(
  boss: PgBoss,
  kind: JobKind,
  singletonKey: string,
  payload: Record<string, string | number | boolean>,
): Promise<string | null> {
  if (!singletonKey.trim()) {
    throw new Error("Queue job requires a non-empty singletonKey");
  }
  return boss.send(kind, payload, { singletonKey });
}
