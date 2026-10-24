import {
  ACCOUNT_CAPABILITIES,
  ACCOUNT_ROLE_CAPABILITIES,
} from "../app/server/capabilities";
import { closeDbPool } from "../app/server/db/client";
import {
  componentDefinitions,
  permissions,
  plans,
  platformSettings,
  platformTemplates,
  rolePermissions,
  roles,
} from "../app/server/db/schema";
import { withPlatform } from "../app/server/db/with-account";
import { emptyDocument } from "../lib/documents";
import { ACCOUNT_ROLES } from "../lib/enums";
import { BLOCK_CATALOG } from "../lib/registry";
import { isMainModule } from "./lib/check";
import { log } from "./lib/log";

const PLAN_SEEDS = [
  { key: "starter", name: "Starter", monthlyMinorUnits: 0, maxSites: 2 },
  { key: "growth", name: "Growth", monthlyMinorUnits: 3900, maxSites: 15 },
  { key: "scale", name: "Scale", monthlyMinorUnits: 12900, maxSites: 100 },
] as const;

const ROLE_RANKS: Record<(typeof ACCOUNT_ROLES)[number], number> = {
  owner: 100,
  admin: 80,
  editor: 50,
  viewer: 20,
};

export async function seedPlatformSettingsAndCatalog(): Promise<void> {
  await withPlatform(async (tx) => {
    for (const plan of PLAN_SEEDS) {
      await tx
        .insert(plans)
        .values({
          key: plan.key,
          name: plan.name,
          monthlyMinorUnits: plan.monthlyMinorUnits,
          currency: "GBP",
          maxSites: plan.maxSites,
          customDomainsIncluded: true,
        })
        .onConflictDoUpdate({
          target: plans.key,
          set: {
            name: plan.name,
            monthlyMinorUnits: plan.monthlyMinorUnits,
            maxSites: plan.maxSites,
          },
        });
    }

    for (const cap of ACCOUNT_CAPABILITIES) {
      const groupKey = cap.split(".")[0] ?? "workspace";
      await tx
        .insert(permissions)
        .values({
          key: cap,
          groupKey,
          label: cap,
          description: `Capability ${cap}`,
        })
        .onConflictDoNothing();
    }

    for (const roleKey of ACCOUNT_ROLES) {
      const [savedRole] = await tx
        .insert(roles)
        .values({
          key: roleKey,
          name: roleKey.charAt(0).toUpperCase() + roleKey.slice(1),
          description: `System ${roleKey} role`,
          rank: ROLE_RANKS[roleKey],
          isSystem: true,
        })
        .onConflictDoUpdate({
          target: roles.key,
          set: { rank: ROLE_RANKS[roleKey], isSystem: true },
        })
        .returning();
      if (savedRole) {
        for (const perm of ACCOUNT_ROLE_CAPABILITIES[roleKey]) {
          await tx
            .insert(rolePermissions)
            .values({ roleId: savedRole.id, permissionKey: perm })
            .onConflictDoNothing();
        }
      }
    }

    for (const spec of BLOCK_CATALOG) {
      await tx
        .insert(componentDefinitions)
        .values({
          alias: spec.alias,
          name: spec.name,
          groupKey: spec.group,
          description: spec.description,
          wave: spec.wave,
          adminOnly: spec.adminOnly,
          fieldCount: spec.fields.length,
          defaultProps: { ...spec.defaultProps },
        })
        .onConflictDoUpdate({
          target: componentDefinitions.alias,
          set: {
            name: spec.name,
            groupKey: spec.group,
            description: spec.description,
            fieldCount: spec.fields.length,
          },
        });
    }

    const starterDoc = emptyDocument("SaaS Launchpad");
    starterDoc.content.push({
      id: "tpl_hero_1",
      type: "hero-banner",
      props: {
        eyebrow: "Ready to ship",
        headline: "Launch your next product page in minutes",
        subheadline: "Structured blocks with immutable snapshots.",
        ctaLabel: "Get started",
        ctaHref: "/sign-up",
      },
    });
    await tx
      .insert(platformTemplates)
      .values({
        slug: "saas-launchpad",
        name: "SaaS Launchpad",
        description:
          "Clean hero and conversion layout for SaaS product launches.",
        category: "landing",
        status: "active",
        document: starterDoc,
      })
      .onConflictDoNothing();

    await tx
      .insert(platformSettings)
      .values({
        key: "platform.registration_open",
        value: true,
        isSecret: false,
        description: "Allow self-service tenant workspace registration",
      })
      .onConflictDoNothing();
  });
}

if (isMainModule(import.meta.url)) {
  void seedPlatformSettingsAndCatalog()
    .then(async () => {
      await closeDbPool();
      log.success(
        "Seeded plans, roles, capabilities, 35 blocks, and platform templates",
      );
    })
    .catch(async (err: unknown) => {
      await closeDbPool();
      log.failed(err instanceof Error ? err.message : "Seed settings failed");
      process.exit(1);
    });
}
