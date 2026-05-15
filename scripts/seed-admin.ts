import "dotenv/config"
import bcrypt from "bcryptjs"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { PrismaClient } from "../src/prisma/client"

const ADMIN_EMAIL = "admin@tyro-study.com"
const ADMIN_PASSWORD = "@Izon2026"
const ADMIN_NAME = "Tyro Admin"

async function main() {
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL or DIRECT_DATABASE_URL is required")
  }

  const pool = new Pool({ connectionString: url })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12)

  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: ADMIN_NAME,
      password: hashed,
      role: "ADMIN",
    },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      password: hashed,
      role: "ADMIN",
    },
  })

  console.log(`Admin user ready: ${user.email} (role: ${user.role})`)
  await prisma.$disconnect()
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
