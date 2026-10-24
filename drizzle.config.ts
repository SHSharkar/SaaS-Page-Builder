import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./app/server/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  strict: true,
  verbose: true,
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://claude_dev@127.0.0.1:5432/saas_page_builder_dev",
  },
});
