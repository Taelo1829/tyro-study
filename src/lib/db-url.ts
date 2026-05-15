/**
 * Resolves a `postgresql://` URL for the `pg` driver.
 * Prisma CLI accepts `prisma+postgres://` (Prisma Postgres dev); the app adapter needs a direct URL.
 */
export function getDatabaseUrl(): string {
  const direct = process.env.DIRECT_DATABASE_URL?.trim()
  if (direct) return direct

  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and configure PostgreSQL."
    )
  }

  if (url.startsWith("postgresql://") || url.startsWith("postgres://")) {
    return url
  }

  if (url.startsWith("prisma+postgres://")) {
    throw new Error(
      "DATABASE_URL uses prisma+postgres:// but DIRECT_DATABASE_URL is missing. " +
        "Either run `docker compose up -d` and set DIRECT_DATABASE_URL in .env (see .env.example), " +
        "or run `npx prisma dev` in a separate terminal and use the postgres:// URL it prints."
    )
  }

  return url
}
