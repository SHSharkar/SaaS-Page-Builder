import "server-only";
import { count, desc, eq } from "drizzle-orm";
import {
  accounts,
  backups,
  componentDefinitions,
  erasureLogs,
  importJobs,
  mediaAssets,
  plans,
  platformAuditLogs,
  platformSettings,
  platformTemplates,
  roles,
  shortLinks,
  siteDomains,
  sites,
  users,
  workerHeartbeats,
} from "@/app/server/db/schema";
import { withPlatform } from "@/app/server/db/with-account";
import { recordPlatformAudit } from "@/app/server/audit";

export async function getPlatformOverviewStats() {
  return withPlatform(async (tx) => {
    const [accountStat] = await tx.select({ total: count() }).from(accounts);
    const [siteStat] = await tx.select({ total: count() }).from(sites);
    const [domainStat] = await tx.select({ total: count() }).from(siteDomains);
    const [userStat] = await tx.select({ total: count() }).from(users);
    return {
      accounts: Number(accountStat?.total ?? 0),
      sites: Number(siteStat?.total ?? 0),
      domains: Number(domainStat?.total ?? 0),
      users: Number(userStat?.total ?? 0),
    };
  });
}

export async function listPlatformAccounts() {
  return withPlatform((tx) =>
    tx.select().from(accounts).orderBy(desc(accounts.createdAt)).limit(100),
  );
}

export async function listPlatformSites() {
  return withPlatform((tx) =>
    tx.select().from(sites).orderBy(desc(sites.createdAt)).limit(100),
  );
}

export async function listPlatformDomains() {
  return withPlatform((tx) =>
    tx
      .select()
      .from(siteDomains)
      .orderBy(desc(siteDomains.createdAt))
      .limit(100),
  );
}

export async function listPlatformUsers() {
  return withPlatform((tx) =>
    tx.select().from(users).orderBy(desc(users.createdAt)).limit(100),
  );
}

export async function listPlatformRoles() {
  return withPlatform((tx) =>
    tx.select().from(roles).orderBy(desc(roles.rank)),
  );
}

export async function listPlatformComponents() {
  return withPlatform((tx) =>
    tx.select().from(componentDefinitions).orderBy(componentDefinitions.alias),
  );
}

export async function listPlatformAuditEntries() {
  return withPlatform((tx) =>
    tx
      .select()
      .from(platformAuditLogs)
      .orderBy(desc(platformAuditLogs.createdAt))
      .limit(100),
  );
}

export async function listWorkerHeartbeats() {
  return withPlatform((tx) =>
    tx
      .select()
      .from(workerHeartbeats)
      .orderBy(desc(workerHeartbeats.updatedAt))
      .limit(50),
  );
}

export async function listPlatformErasureLogs() {
  return withPlatform((tx) =>
    tx
      .select()
      .from(erasureLogs)
      .orderBy(desc(erasureLogs.erasedAt))
      .limit(100),
  );
}

export async function listPlatformRecordsSummary() {
  return withPlatform(async (tx) => {
    const tpls = await tx.select().from(platformTemplates).limit(50);
    const imps = await tx.select().from(importJobs).limit(50);
    const meds = await tx.select().from(mediaAssets).limit(50);
    const links = await tx.select().from(shortLinks).limit(50);
    const baks = await tx.select().from(backups).limit(50);
    const stgs = await tx
      .select({
        key: platformSettings.key,
        isSecret: platformSettings.isSecret,
        description: platformSettings.description,
        updatedAt: platformSettings.updatedAt,
      })
      .from(platformSettings);
    const plns = await tx.select().from(plans);
    return {
      templates: tpls,
      imports: imps,
      media: meds,
      shortLinks: links,
      backups: baks,
      settings: stgs,
      plans: plns,
    };
  });
}

export async function setTenantAccountStatus(input: {
  actorUserId: string;
  accountId: string;
  status: "active" | "suspended";
}): Promise<void> {
  await withPlatform(async (tx) => {
    await tx
      .update(accounts)
      .set({ status: input.status, updatedAt: new Date() })
      .where(eq(accounts.id, input.accountId));
    await recordPlatformAudit(tx, {
      actorUserId: input.actorUserId,
      action: `platform.account_${input.status}`,
      targetType: "account",
      targetId: input.accountId,
      summary: `Set tenant account status to ${input.status}`,
    });
  });
}
