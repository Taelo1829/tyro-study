/**
 * Student feedback (table feedback): bugs, ideas, content mistakes. Raw SQL
 * with fallbacks until the table is in schema.prisma (ADR 0004).
 */
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/prisma"

export const FEEDBACK_KINDS = ["bug", "idea", "content", "other"] as const
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]
export const FEEDBACK_STATUSES = ["new", "planned", "done", "wontfix"] as const
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]
export const FEEDBACK_MIN = 5
export const FEEDBACK_MAX = 2000

export const isFeedbackKind = (v: unknown): v is FeedbackKind => FEEDBACK_KINDS.includes(v as FeedbackKind)
export const isFeedbackStatus = (v: unknown): v is FeedbackStatus => FEEDBACK_STATUSES.includes(v as FeedbackStatus)

export interface FeedbackRow {
  id: string
  userId: string | null
  userName: string | null
  userEmail: string | null
  kind: FeedbackKind
  message: string
  page: string | null
  appVersion: string | null
  status: FeedbackStatus
  adminNote: string | null
  createdAt: Date
}

export async function createFeedback(input: { userId: string; kind: FeedbackKind; message: string; page: string | null }) {
  const id = randomUUID()
  await prisma.$executeRaw`
    INSERT INTO "feedback" ("id", "userId", "kind", "message", "page", "appVersion")
    VALUES (${id}, ${input.userId}, ${input.kind}, ${input.message}, ${input.page}, ${process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null})`
  return id
}

/** For admins. `status` "open" = new + planned. */
export async function listFeedback(status: FeedbackStatus | "open" | "all" = "open", limit = 200): Promise<FeedbackRow[]> {
  try {
    return await prisma.$queryRaw<FeedbackRow[]>`
      SELECT f."id", f."userId", u."name" AS "userName", u."email" AS "userEmail", f."kind", f."message",
             f."page", f."appVersion", f."status", f."adminNote", f."createdAt"
      FROM "feedback" f LEFT JOIN "users" u ON u."id" = f."userId"
      WHERE ${status} = 'all' OR f."status" = ${status} OR (${status} = 'open' AND f."status" IN ('new', 'planned'))
      ORDER BY f."createdAt" DESC
      LIMIT ${limit}`
  } catch {
    return []
  }
}

export async function updateFeedback(id: string, data: { status?: FeedbackStatus; adminNote?: string | null }): Promise<boolean> {
  const n = await prisma.$executeRaw`
    UPDATE "feedback"
    SET "status" = COALESCE(${data.status ?? null}, "status"),
        "adminNote" = CASE WHEN ${data.adminNote !== undefined}::boolean THEN ${data.adminNote ?? null} ELSE "adminNote" END,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}`
  return n > 0
}

/** Counts per kind in the last `days` days, for the digest and the metrics review. */
export async function feedbackCounts(days = 7): Promise<{ kind: string; status: string; n: number }[]> {
  try {
    const rows = await prisma.$queryRaw<{ kind: string; status: string; n: number }[]>`
      SELECT "kind", "status", COUNT(*)::int AS n FROM "feedback"
      WHERE "createdAt" > NOW() - make_interval(days => ${days}::int)
      GROUP BY 1, 2 ORDER BY 1, 2`
    return rows.map(r => ({ ...r, n: Number(r.n) }))
  } catch {
    return []
  }
}
