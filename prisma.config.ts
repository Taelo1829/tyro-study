// Prisma CLI config (migrate, generate, studio).
//
// Next.js keeps environment variables in .env.local, but `import "dotenv/config"`
// only reads .env — so Prisma couldn't find the database and `migrate deploy`
// failed with "datasource.url property is required". Read .env.local first,
// then .env (values already set in the shell or on Vercel always win).
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: [".env.local", ".env"], quiet: true });

// Migrations should use the direct (non-pooled) connection when there is one;
// running them through a connection pooler (pgbouncer) can fail on locks.
const databaseUrl =
  process.env["DIRECT_DATABASE_URL"] ??
  process.env["DATABASE_URL_UNPOOLED"] ??
  process.env["POSTGRES_URL_NON_POOLING"] ??
  process.env["DATABASE_URL"];

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
