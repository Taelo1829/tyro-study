import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import { getTutorialGuide } from "@/lib/tutorial-letter"
import { weeklyPlannerEnabled } from "@/lib/weekly-planner-settings"
import { buildWeeklyStudyPlan, studyDate, validStudyDate, type SavedStudyTask } from "@/lib/weekly-study-plan"

type Context = { params: Promise<{ id: string }> }
const prefixFor = (userId: string, moduleId: string) => `weekly-${createHash("sha256").update(JSON.stringify([userId, moduleId])).digest("hex").slice(0, 32)}-`
async function access(context: Context) {
  const auth = await requireAuth()
  if (auth.error) return { error: auth.error }
  const moduleId = (await context.params).id
  const enrolled = await prisma.moduleEnrollment.findUnique({ where: { userId_moduleId: { userId: auth.userId!, moduleId } }, select: { id: true } })
  if (!enrolled) return { error: NextResponse.json({ error: "Join this module before creating a study plan." }, { status: 403 }) }
  return { userId: auth.userId!, moduleId, prefix: prefixFor(auth.userId!, moduleId) }
}
async function list(userId: string, moduleId: string, prefix: string) {
  return prisma.$queryRaw<SavedStudyTask[]>`SELECT "id", "title", "notes", to_char("startAt", 'YYYY-MM-DD') AS "date", "completed", ("remindAt" IS NOT NULL) AS "reminders" FROM "calendar_events" WHERE "userId" = ${userId} AND "moduleId" = ${moduleId} AND starts_with("id", ${prefix}) ORDER BY "startAt", "id"`
}
export async function GET(_request: Request, context: Context) {
  const auth = await access(context)
  if (auth.error) return auth.error
  try {
    const enabled = await weeklyPlannerEnabled(auth.moduleId!)
    return NextResponse.json({ enabled, tasks: enabled ? await list(auth.userId!, auth.moduleId!, auth.prefix!) : [] })
  }
  catch { return NextResponse.json({ error: "Could not load your weekly planner." }, { status: 503 }) }
}
export async function POST(request: Request, context: Context) {
  const auth = await access(context)
  if (auth.error) return auth.error
  const { userId, moduleId, prefix } = auth as { userId: string; moduleId: string; prefix: string }
  const body = await request.json().catch(() => ({}))
  if (!["create", "reschedule", "complete"].includes(body.action)) return NextResponse.json({ error: "Choose a valid planner action." }, { status: 400 })
  if (body.action === "complete") {
    if (typeof body.taskId !== "string" || !body.taskId.startsWith(prefix) || typeof body.completed !== "boolean") return NextResponse.json({ error: "Choose one of your study tasks." }, { status: 400 })
  } else if (!validStudyDate(body.startDate) || typeof body.reminders !== "boolean") return NextResponse.json({ error: "Choose a valid start date and reminder preference." }, { status: 400 })
  try {
    if (!await weeklyPlannerEnabled(moduleId)) return NextResponse.json({ error: "The weekly planner is turned off for this module.", enabled: false }, { status: 403 })
    let schedule: ReturnType<typeof buildWeeklyStudyPlan> = []
    if (body.action === "create") {
      const guide = await getTutorialGuide(moduleId)
      if (!guide) return NextResponse.json({ error: "An admin must import a tutorial letter with a study schedule first." }, { status: 400 })
      try { schedule = buildWeeklyStudyPlan(guide, body.startDate) }
      catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid study schedule." }, { status: 400 }) }
    }
    await prisma.$transaction(async tx => {
      // Serialize this student's planner actions, including duplicate create requests.
      await tx.$queryRaw`SELECT "id" FROM "module_enrollments" WHERE "userId" = ${userId} AND "moduleId" = ${moduleId} FOR UPDATE`
      if (body.action === "complete") {
        await tx.$executeRaw`UPDATE "calendar_events" SET "completed" = ${body.completed}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${body.taskId} AND "userId" = ${userId} AND "moduleId" = ${moduleId}`
        return
      }
      const existing = await tx.$queryRaw<{ id: string; completed: boolean }[]>`SELECT "id", "completed" FROM "calendar_events" WHERE "userId" = ${userId} AND "moduleId" = ${moduleId} AND starts_with("id", ${prefix}) ORDER BY "startAt", "id" FOR UPDATE`
      if (body.action === "create" && existing.length) return
      const dates = body.action === "create" ? schedule.map(s => ({ id: prefix + String(s.week).padStart(3, "0"), date: s.date, title: s.title, notes: s.notes })) : existing.filter(e => !e.completed).map((e, i) => ({ id: e.id, date: studyDate(body.startDate, i), title: "", notes: "" }))
      for (const task of dates) {
        // 09:00 South Africa (UTC+02:00); date-only targets never shift with the server's timezone.
        const when = `${task.date}T07:00:00.000Z`
        const reminder = body.reminders && Date.parse(when) > Date.now() ? when : null
        if (body.action === "create") {
          await tx.$executeRaw`INSERT INTO "calendar_events" ("id", "userId", "moduleId", "type", "title", "notes", "startAt", "allDay", "remindAt") VALUES (${task.id}, ${userId}, ${moduleId}, 'STUDY_SESSION', ${task.title}, ${task.notes}, ${when}::timestamptz AT TIME ZONE 'UTC', true, ${reminder}::timestamptz AT TIME ZONE 'UTC')`
        } else {
          await tx.$executeRaw`UPDATE "calendar_events" SET "startAt" = ${when}::timestamptz AT TIME ZONE 'UTC', "endAt" = NULL, "remindAt" = ${reminder}::timestamptz AT TIME ZONE 'UTC', "remindedAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${task.id} AND "userId" = ${userId} AND "moduleId" = ${moduleId} AND "completed" = false`
        }
      }
    }, { maxWait: 10000, timeout: 60000 })
    return NextResponse.json(await list(userId, moduleId, prefix))
  } catch (e) {
    console.error("Weekly study plan failed", e)
    return NextResponse.json({ error: "Could not save your weekly planner. Please retry." }, { status: 500 })
  }
}
