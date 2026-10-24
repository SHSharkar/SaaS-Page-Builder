import { applyDevelopmentEnvDefaults } from "./lib/development-env";
import {
  resolveTestDatabaseUrl,
  resolveTestRedisUrl,
} from "./vitest.test-database";

process.env.DATABASE_URL = resolveTestDatabaseUrl();
process.env.REDIS_URL = resolveTestRedisUrl();
applyDevelopmentEnvDefaults();
