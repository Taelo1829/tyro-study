import { config } from "dotenv"
import bcrypt from "bcryptjs"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { PrismaClient } from "../src/prisma/client"

// Same files Prisma reads (prisma.config.ts): .env.local first, then .env
config({ path: [".env.local", ".env"], quiet: true })

/**
 * Creates (or resets) an admin account for a development database.
 *
 *   SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='a long passphrase' npm run db:seed
 *
 * The email and password come from the environment (.env or the shell), never
 * from this file, so no credentials live in Git. It refuses to run against a
 * database that isn't on this machine unless SEED_ALLOW_REMOTE=1 is set,
 * because it resets the password of an existing account with that email.
 */
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.SEED_ADMIN_PASSWORD ?? ""
  const name = process.env.SEED_ADMIN_NAME?.trim() || "Tyro Admin"
  if (!email || !password) {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (in .env or the shell) to seed an admin")
  }
  if (password.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters")
  }

  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL or DIRECT_DATABASE_URL is required")
  }
  const host = new URL(url).hostname
  if (!["localhost", "127.0.0.1", "::1"].includes(host) && process.env.SEED_ALLOW_REMOTE !== "1") {
    throw new Error(`Refusing to seed ${host}: it isn't a local database. Set SEED_ALLOW_REMOTE=1 if you really mean it.`)
  }

  const pool = new Pool({ connectionString: url })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  const hashed = await bcrypt.hash(password, 12)

  await prisma.user.upsert({
    where: { email },
    update: { name, password: hashed, role: "ADMIN" },
    create: { email, name, password: hashed, role: "ADMIN", emailVerified: new Date() },
  })
  console.log(`Admin ready: ${email}`)

  await prisma.$disconnect()
  await pool.end()
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
