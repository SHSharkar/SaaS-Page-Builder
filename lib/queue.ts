import "server-only";
import { and, eq, lte, sql } from "drizzle-orm";
import {
  PgBoss,
  fromDrizzle,
  fromPglite,
  type DrizzleSqlTagLike,
  type DrizzleTransactionLike,
  type JobWithMetadata,
} from "pg-boss";
import { databaseBackend, db, ensureDb, getPgliteInstance } from "@/lib/db";
import { domains, pages } from "@/lib/db/schema";
import { JOB_KINDS, type JobKind } from "@/lib/enums";
import { logger } from "@/lib/logger";

export type { JobKind };

interface QueueRuntime {
  boss?: PgBoss;
  ready?: Promise<PgBoss>;
  workersStarted?: boolean;
}

const runtime = globalThis as unknown as { __trofeoQueueRuntime?: QueueRuntime };

function queueState(): QueueRuntime {
  if (!runtime.__trofeoQueueRuntime) {
    runtime.__trofeoQueueRuntime = {};
  }
  return runtime.__trofeoQueueRuntime;
}

const QUEUE_POLICIES: Record<
  JobKind,
  { retryLimit: number; retryDelay: number; retryDelayMax: number; expireInSeconds: number }
> = {
  "page.scheduled-publish": {
    retryLimit: 5,
    retryDelay: 15,
    retryDelayMax: 600,
    expireInSeconds: 120,
  },
  "page.scheduled-unpublish": {
    retryLimit: 5,
    retryDelay: 15,
    retryDelayMax: 600,
    expireInSeconds: 120,
  },
  "domain.verify": {
    retryLimit: 6,
    retryDelay: 30,
    retryDelayMax: 3_600,
    expireInSeconds: 120,
  },
  "media.orphan-sweep": {
    retryLimit: 3,
    retryDelay: 60,
    retryDelayMax: 1_800,
    expireInSeconds: 300,
  },
  "sweeper.daily": {
    retryLimit: 3,
    retryDelay: 120,
    retryDelayMax: 3_600,
    expireInSeconds: 600,
  },
};

export async function getBoss(): Promise<PgBoss> {
  const current = queueState();
  if (!current.ready) {
    current.ready = (async () => {
      await ensureDb();
      const backend = databaseBackend();
      let boss: PgBoss;
      if (backend === "postgres") {
        boss = new PgBoss({
          connectionString: process.env.DATABASE_URL!.trim(),
          schema: "pgboss",
          backend: "postgres",
          application_name: "trofeo-pages-boss",
          supervise: false,
          schedule: false,
        });
      } else {
        const pglite = getPgliteInstance();
        if (!pglite) {
          throw new Error("PGlite instance was not initialized before starting pg-boss.");
        }
        boss = new PgBoss({
          db: fromPglite(pglite),
          schema: "pgboss",
          backend: "pglite",
          supervise: false,
          schedule: false,
          registerInstance: false,
          monitorVacuum: false,
          reindex: false,
        });
      }

      boss.on("error", (err) => {
        logger.error({ err }, "pg-boss runtime error");
      });

      await boss.start();

      for (const kind of JOB_KINDS) {
        const dlq = `${kind}.dlq`;
        const cfg = QUEUE_POLICIES[kind];
        await boss.createQueue(dlq, {
          policy: "standard",
          retentionSeconds: 14 * 86_400,
          deleteAfterSeconds: 30 * 86_400,
        });
        await boss.createQueue(kind, {
          policy: "short",
          deadLetter: dlq,
          retryLimit: cfg.retryLimit,
          retryDelay: cfg.retryDelay,
          retryBackoff: true,
          retryDelayMax: cfg.retryDelayMax,
          expireInSeconds: cfg.expireInSeconds,
          retentionSeconds: 14 * 86_400,
          deleteAfterSeconds: 7 * 86_400,
        });
      }

      current.boss = boss;
      return boss;
    })().catch((err) => {
      current.ready = undefined;
      throw err;
    });
  }
  return current.ready;
}

export async function enqueue(
  kind: JobKind,
  payload: Record<string, unknown>,
  options: {
    runAt?: Date;
    dedupeKey?: string;
    maxAttempts?: number;
    tx?: unknown;
  } = {},
): Promise<string | null> {
  const boss = await getBoss();
  const txDb = options.tx
    ? fromDrizzle(options.tx as DrizzleTransactionLike, sql as unknown as DrizzleSqlTagLike)
    : undefined;

  if (options.dedupeKey) {
    const result = await boss.upsert(kind, payload, {
      singletonKey: options.dedupeKey,
      ...(options.runAt ? { startAfter: options.runAt } : {}),
      ...(options.maxAttempts !== undefined ? { retryLimit: options.maxAttempts } : {}),
      ...(txDb ? { db: txDb } : {}),
    });
    return result.jobs[0] ?? null;
  }

  return boss.send(kind, payload, {
    ...(options.runAt ? { startAfter: options.runAt } : {}),
    ...(options.maxAttempts !== undefined ? { retryLimit: options.maxAttempts } : {}),
    ...(txDb ? { db: txDb } : {}),
  });
}

export async function cancelByKey(kind: JobKind, dedupeKey: string): Promise<void> {
  const boss = await getBoss();
  const matches = await boss.findJobs(kind, { key: dedupeKey, queued: true, limit: 20 });
  if (matches.length > 0) {
    await boss.cancel(
      kind,
      matches.map((item) => item.id),
    );
  }
}

async function handleJob(kind: JobKind, payload: Record<string, unknown>): Promise<void> {
  const now = new Date();
  switch (kind) {
    case "page.scheduled-publish": {
      const pageId = String(payload.pageId ?? "");
      const siteId = String(payload.siteId ?? "");
      if (!pageId || !siteId) return;
      const [row] = await db
        .select()
        .from(pages)
        .where(and(eq(pages.id, pageId), lte(pages.scheduledPublishAt, now)))
        .limit(1);
      if (!row) return;
      const { publishPage } = await import("./pages");
      await publishPage(siteId, pageId, null, { note: "Scheduled publish" });
      await db.update(pages).set({ scheduledPublishAt: null }).where(eq(pages.id, pageId));
      return;
    }

    case "page.scheduled-unpublish": {
      const pageId = String(payload.pageId ?? "");
      const siteId = String(payload.siteId ?? "");
      if (!pageId || !siteId) return;
      const [row] = await db
        .select()
        .from(pages)
        .where(and(eq(pages.id, pageId), lte(pages.scheduledUnpublishAt, now)))
        .limit(1);
      if (!row) return;
      const { unpublishPage } = await import("./pages");
      await unpublishPage(siteId, pageId, null);
      await db.update(pages).set({ scheduledUnpublishAt: null }).where(eq(pages.id, pageId));
      return;
    }

    case "domain.verify": {
      const domainId = String(payload.domainId ?? "");
      if (!domainId) return;
      const { verifyDomain } = await import("./domains");
      const outcome = await verifyDomain(domainId, null);
      if (outcome.status === "verifying") {
        const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
        if (domain && domain.expiresAt && domain.expiresAt > now) {
          const delayMinutes = Math.min(360, 2 ** Math.min(domain.checkAttempts, 8));
          await enqueue(
            "domain.verify",
            { domainId },
            {
              dedupeKey: `domain:verify:${domainId}`,
              runAt: new Date(Date.now() + delayMinutes * 60_000),
            },
          );
        } else if (domain) {
          await db
            .update(domains)
            .set({
              status: "failed",
              failureReason: "The seven-day verification window elapsed without seeing the DNS TXT record.",
              updatedAt: now,
            })
            .where(eq(domains.id, domainId));
        }
      }
      return;
    }

    case "media.orphan-sweep": {
      const { sweepOrphanMedia } = await import("./sweeper");
      await sweepOrphanMedia(now);
      return;
    }

    case "sweeper.daily": {
      const { runDailyCleanup } = await import("./sweeper");
      await runDailyCleanup(null);
      return;
    }
  }
}

export async function runDueJobs(limit = 10): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const boss = await getBoss();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const kind of JOB_KINDS) {
    if (processed >= limit) break;
    const batchSize = Math.max(1, limit - processed);
    const claimed = await boss.fetch<Record<string, unknown>>(kind, {
      batchSize,
      includeMetadata: true,
    });

    for (const job of claimed) {
      processed += 1;
      try {
        await handleJob(kind, job.data ?? {});
        await boss.complete(kind, { id: job.id, retryCount: job.retryCount });
        succeeded += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn({ kind, jobId: job.id, err: message }, "Background job failed");
        await boss.fail(kind, { id: job.id, retryCount: job.retryCount }, { error: message });
        failed += 1;
      }
    }
  }

  return { processed, succeeded, failed };
}

export interface RecentJobSummary {
  id: string;
  kind: JobKind;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: Date;
}

function mapStateToBadge(state: JobWithMetadata["state"]): string {
  switch (state) {
    case "completed":
      return "ready";
    case "active":
      return "verifying";
    case "failed":
      return "failed";
    case "cancelled":
      return "discarded";
    case "retry":
    case "created":
    default:
      return "pending";
  }
}

export async function listRecentJobs(limit = 30): Promise<RecentJobSummary[]> {
  const boss = await getBoss();
  const perQueue = await Promise.all(
    JOB_KINDS.map(async (kind) => {
      const rows = await boss.findJobs<Record<string, unknown>>(kind, {
        limit: Math.min(limit, 25),
      });
      return rows.map((row): RecentJobSummary => {
        const out = row.output as { error?: string; message?: string } | null;
        return {
          id: row.id,
          kind,
          status: mapStateToBadge(row.state),
          attempts: row.retryCount,
          maxAttempts: row.retryLimit + 1,
          lastError: out?.error ?? out?.message ?? null,
          createdAt: row.createdOn instanceof Date ? row.createdOn : new Date(row.createdOn),
        };
      });
    }),
  );

  return perQueue
    .flat()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export async function startWorkerProcess(): Promise<PgBoss> {
  await ensureDb();
  const backend = databaseBackend();
  const boss =
    backend === "postgres"
      ? new PgBoss({
          connectionString: process.env.DATABASE_URL!.trim(),
          schema: "pgboss",
          backend: "postgres",
          application_name: "trofeo-pages-worker",
          supervise: true,
          schedule: true,
        })
      : await getBoss();

  if (backend === "postgres") {
    boss.on("error", (err) => {
      logger.error({ err }, "Worker pg-boss error");
    });
    await boss.start();
    for (const kind of JOB_KINDS) {
      const dlq = `${kind}.dlq`;
      const cfg = QUEUE_POLICIES[kind];
      await boss.createQueue(dlq, {
        policy: "standard",
        retentionSeconds: 14 * 86_400,
        deleteAfterSeconds: 30 * 86_400,
      });
      await boss.createQueue(kind, {
        policy: "short",
        deadLetter: dlq,
        retryLimit: cfg.retryLimit,
        retryDelay: cfg.retryDelay,
        retryBackoff: true,
        retryDelayMax: cfg.retryDelayMax,
        expireInSeconds: cfg.expireInSeconds,
        retentionSeconds: 14 * 86_400,
        deleteAfterSeconds: 7 * 86_400,
      });
    }
  }

  await boss.schedule("sweeper.daily", "15 3 * * *", {}, { tz: "UTC", key: "daily-sweeper", missed: "once" });

  for (const kind of JOB_KINDS) {
    await boss.work<Record<string, unknown>>(
      kind,
      { batchSize: 1, pollingIntervalSeconds: 2 },
      async (jobs) => {
        for (const job of jobs) {
          await handleJob(kind, job.data ?? {});
        }
      },
    );
  }

  return boss;
}

export async function stopBoss(): Promise<void> {
  const current = queueState();
  if (current.boss) {
    await current.boss.stop({ graceful: true, timeout: 10_000 });
    current.boss = undefined;
    current.ready = undefined;
  }
}

export async function getQueueHealth(): Promise<{
  backend: "postgres" | "pglite";
  mode: "postgres" | "pglite";
  ready: boolean;
  queues: number;
  queued: number;
  failed: number;
}> {
  await ensureDb();
  const current = queueState();
  const backend = databaseBackend();
  return {
    backend,
    mode: backend,
    ready: Boolean(current.boss),
    queues: JOB_KINDS.length,
    queued: 0,
    failed: 0,
  };
}

