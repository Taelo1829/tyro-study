import { prisma } from "@/lib/prisma"

interface StreakUser {
  role: "STUDENT" | "ADMIN"
  streakDays: number
}

export async function recordDailyVisit(userId: string): Promise<StreakUser | null> {
  const rows = await prisma.$queryRaw<StreakUser[]>`
    UPDATE "users"
    SET
      "streakDays" = CASE
        WHEN "lastVisitDate" IS NULL THEN 1
        WHEN DATE("lastVisitDate" AT TIME ZONE 'Africa/Johannesburg') = DATE(NOW() AT TIME ZONE 'Africa/Johannesburg') THEN "streakDays"
        WHEN DATE("lastVisitDate" AT TIME ZONE 'Africa/Johannesburg') = DATE(NOW() AT TIME ZONE 'Africa/Johannesburg') - INTERVAL '1 day' THEN "streakDays" + 1
        ELSE 1
      END,
      "lastVisitDate" = CASE
        WHEN "lastVisitDate" IS NULL OR DATE("lastVisitDate" AT TIME ZONE 'Africa/Johannesburg') < DATE(NOW() AT TIME ZONE 'Africa/Johannesburg') THEN NOW()
        ELSE "lastVisitDate"
      END
    WHERE "id" = ${userId}
    RETURNING "role", "streakDays"
  `

  return rows[0] ?? null
}
