import { prisma } from "@/lib/prisma"

interface StreakUser {
  role: "STUDENT" | "ADMIN"
  streakDays: number
}

/**
 * Record today's visit and return the user's current streak.
 *
 * Days are counted in South African time (Africa/Johannesburg):
 *  - first visit ever            → 1
 *  - already visited today       → unchanged
 *  - last visit was yesterday    → +1
 *  - missed a day or more        → back to 1
 *
 * "lastVisitDate" is a TIMESTAMP (no time zone) column that Prisma fills with
 * UTC. It must be marked as UTC first (`AT TIME ZONE 'UTC'`) before converting
 * to SA time. The old query skipped that step, so its idea of "last visit" was
 * 4 hours off — anyone whose first visit of the day was between midnight and
 * 4am got +2 for that day instead of +1. The new visit time is also stored
 * explicitly as UTC so the result never depends on the DB session time zone.
 */
export async function recordDailyVisit(userId: string): Promise<StreakUser | null> {
  const rows = await prisma.$queryRaw<StreakUser[]>`
    UPDATE "users"
    SET
      "streakDays" = CASE
        WHEN "lastVisitDate" IS NULL THEN 1
        WHEN DATE(("lastVisitDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Johannesburg')
             = DATE(NOW() AT TIME ZONE 'Africa/Johannesburg')
          THEN GREATEST("streakDays", 1)
        WHEN DATE(("lastVisitDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Johannesburg')
             = DATE(NOW() AT TIME ZONE 'Africa/Johannesburg') - 1
          THEN "streakDays" + 1
        ELSE 1
      END,
      "lastVisitDate" = NOW() AT TIME ZONE 'UTC'
    WHERE "id" = ${userId}
    RETURNING "role", "streakDays"
  `

  return rows[0] ?? null
}
