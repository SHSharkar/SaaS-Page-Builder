import "server-only";
import { Client } from "pg";
import { getEnv } from "@/app/server/env";
import { logger } from "@/app/server/logger";
import { ACCOUNT_CHANGED_CHANNEL } from "./publish";

type AccountListener = (payload: string) => void;

interface MultiplexerState {
  client: Client | null;
  connecting: Promise<void> | null;
  subscribers: Set<AccountListener>;
}

const globalForRealtime = globalThis as unknown as {
  __spbRealtimeState?: MultiplexerState;
};

function getState(): MultiplexerState {
  if (!globalForRealtime.__spbRealtimeState) {
    globalForRealtime.__spbRealtimeState = {
      client: null,
      connecting: null,
      subscribers: new Set(),
    };
  }
  return globalForRealtime.__spbRealtimeState;
}

async function ensureConnected(state: MultiplexerState): Promise<void> {
  if (state.client) {
    return;
  }
  if (state.connecting) {
    return state.connecting;
  }
  state.connecting = (async () => {
    const env = getEnv();
    const client = new Client({ connectionString: env.DATABASE_URL });
    client.on("error", (err) => {
      logger.warn({ message: err.message }, "realtime.listener_error");
      state.client = null;
    });
    client.on("notification", (msg) => {
      if (msg.channel === ACCOUNT_CHANGED_CHANNEL && msg.payload) {
        for (const fn of state.subscribers) {
          fn(msg.payload);
        }
      }
    });
    await client.connect();
    await client.query(`LISTEN ${ACCOUNT_CHANGED_CHANNEL}`);
    state.client = client;
  })().finally(() => {
    state.connecting = null;
  });
  return state.connecting;
}

export async function subscribeAccountEvents(
  listener: AccountListener,
): Promise<() => void> {
  const state = getState();
  state.subscribers.add(listener);
  try {
    await ensureConnected(state);
  } catch (err) {
    logger.warn(
      { message: err instanceof Error ? err.message : "unknown" },
      "realtime.subscribe_failed",
    );
  }
  return () => {
    state.subscribers.delete(listener);
  };
}
