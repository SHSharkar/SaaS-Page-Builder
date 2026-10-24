import { closeDbPool, getDbPool } from "../app/server/db/client";
import { isMainModule } from "./lib/check";

export const HEARTBEAT_STALE_MS = 45_000;

export interface HeartbeatState {
  readonly ageMs: number | null;
  readonly claimingWork: boolean;
}

export function isHeartbeatHealthy(state: HeartbeatState): boolean {
  return (
    state.claimingWork &&
    state.ageMs !== null &&
    state.ageMs >= 0 &&
    state.ageMs <= HEARTBEAT_STALE_MS
  );
}

export async function readHeartbeatState(): Promise<HeartbeatState> {
  const res = await getDbPool().query<{
    claiming_work: boolean;
    age_ms: string | null;
  }>(
    "SELECT claiming_work, EXTRACT(EPOCH FROM (now() - updated_at)) * 1000 AS age_ms FROM worker_heartbeats ORDER BY updated_at DESC LIMIT 1",
  );
  const row = res.rows[0];
  if (!row) {
    return { ageMs: null, claimingWork: false };
  }
  return {
    ageMs: row.age_ms === null ? null : Number(row.age_ms),
    claimingWork: row.claiming_work,
  };
}

export async function runHealthcheck(): Promise<boolean> {
  const state = await readHeartbeatState();
  return isHeartbeatHealthy(state);
}

if (isMainModule(import.meta.url)) {
  void runHealthcheck()
    .then(async (healthy) => {
      await closeDbPool();
      process.exit(healthy ? 0 : 1);
    })
    .catch(async () => {
      await closeDbPool();
      process.exit(1);
    });
}
