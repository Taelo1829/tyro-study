import { prisma } from "@/lib/prisma"

/**
 * Superusers are admins who manage other admins: they can change anyone's
 * role, grant or remove superuser, and delete admin accounts. Ordinary admins
 * manage content and students.
 *
 * Superusers are granted by another superuser on Admin → Users. (If there
 * were ever no superuser at all, every admin would get these rights back so
 * nobody is locked out; the "last superuser" checks prevent that.)
 *
 * The isSuperuser column is read/written with SQL so it works whether or not
 * the Prisma client has been regenerated since it was added.
 */
export async function superuserIds(userIds?: string[]): Promise<Set<string>> {
  const rows = userIds
    ? await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "users" WHERE "isSuperuser" = true AND "id" = ANY(${userIds})`
    : await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "users" WHERE "isSuperuser" = true`
  return new Set(rows.map(r => r.id))
}

export async function superuserCount(): Promise<number> {
  const [row] = await prisma.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS "n" FROM "users" WHERE "isSuperuser" = true`
  return row?.n ?? 0
}

export async function isSuperuser(userId: string): Promise<boolean> {
  return (await superuserIds([userId])).has(userId)
}

export async function setSuperuser(userId: string, value: boolean) {
  await prisma.$executeRaw`UPDATE "users" SET "isSuperuser" = ${value} WHERE "id" = ${userId}`
}

/** Can this admin manage other admins? Superusers can; before the first superuser exists, every admin can. */
export async function canManageAdmins(userId: string): Promise<boolean> {
  return (await superuserCount()) === 0 || (await isSuperuser(userId))
}

export const SUPERUSER_ONLY = "Only a superuser can do that"

