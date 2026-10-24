import type { VerifyTier } from "./verify-tier";

export interface GateStep {
  readonly id: string;
  readonly command: string;
  readonly minTier: VerifyTier;
}

const TIER_RANK: Record<VerifyTier, number> = {
  fast: 1,
  code: 2,
  schema: 3,
  full: 4,
};

export const GATE_STEPS: readonly GateStep[] = [
  { id: "format", command: "bun run format:check", minTier: "fast" },
  { id: "wording", command: "bun run verify:wording", minTier: "fast" },
  { id: "shell", command: "bun run verify:shell", minTier: "fast" },
  { id: "naming", command: "bun run verify:naming", minTier: "code" },
  { id: "typecheck", command: "bun run typecheck", minTier: "code" },
  { id: "lint", command: "bun run lint", minTier: "code" },
  { id: "lint-css", command: "bun run lint:css", minTier: "code" },
  { id: "contrast", command: "bun run verify:contrast", minTier: "code" },
  {
    id: "client-boundary",
    command: "bun run verify:client-boundary",
    minTier: "code",
  },
  { id: "deps", command: "bun run verify:deps", minTier: "code" },
  { id: "authz", command: "bun run verify:authz", minTier: "code" },
  {
    id: "capabilities",
    command: "bun run verify:capabilities",
    minTier: "code",
  },
  { id: "roles", command: "bun run verify:roles", minTier: "code" },
  {
    id: "tenant-delete",
    command: "bun run verify:tenant-delete",
    minTier: "code",
  },
  {
    id: "queue-policies",
    command: "bun run verify:queue-policies",
    minTier: "code",
  },
  {
    id: "message-catalog",
    command: "bun run verify:message-catalog",
    minTier: "code",
  },
  { id: "migrations", command: "bun run verify:migrations", minTier: "schema" },
  {
    id: "migration-safety",
    command: "bun run verify:migration-safety",
    minTier: "schema",
  },
  { id: "rls", command: "bun run verify:rls", minTier: "schema" },
  { id: "unused", command: "bun run verify:unused", minTier: "full" },
  { id: "audit", command: "bun run verify:audit", minTier: "full" },
  { id: "licenses", command: "bun run verify:licenses", minTier: "full" },
  { id: "test-coverage", command: "bun run test:coverage", minTier: "code" },
  { id: "preflight", command: "bun run preflight", minTier: "schema" },
];

export function planGateSteps(tier: VerifyTier): GateStep[] {
  const rank = TIER_RANK[tier];
  return GATE_STEPS.filter((step) => TIER_RANK[step.minTier] <= rank);
}
