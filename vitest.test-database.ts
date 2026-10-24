export function resolveTestDatabaseUrl(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  if (env.TEST_DATABASE_URL && env.TEST_DATABASE_URL.trim().length > 0) {
    return env.TEST_DATABASE_URL.trim();
  }
  const host = env.SPB_LOCAL_PG_HOST ?? "127.0.0.1";
  const port = env.SPB_LOCAL_PG_PORT ?? "5432";
  const user = env.SPB_LOCAL_PG_USER ?? "claude_dev";
  const dbName = env.SPB_LOCAL_PG_TEST_DB ?? "saas_page_builder_test";
  return `postgresql://${user}@${host}:${port}/${dbName}`;
}

export function resolveTestRedisUrl(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  if (env.TEST_REDIS_URL && env.TEST_REDIS_URL.trim().length > 0) {
    return env.TEST_REDIS_URL.trim();
  }
  const host = env.SPB_LOCAL_VALKEY_HOST ?? "127.0.0.1";
  const port = env.SPB_LOCAL_VALKEY_PORT ?? "6379";
  return `redis://${host}:${port}/1`;
}
