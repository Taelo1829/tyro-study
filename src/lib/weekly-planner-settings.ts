import { prisma } from "@/lib/prisma"

export async function weeklyPlannerEnabled(moduleId: string) {
  const [row] = await prisma.$queryRaw<{ enabled: boolean }[]>`SELECT COALESCE((to_jsonb(m)->>'weeklyPlannerEnabled')::boolean, false) AS enabled FROM "modules" m WHERE m."id" = ${moduleId}`
  return row?.enabled ?? false
}
export async function plannerEventDisabled(eventId: string) {
  if (!eventId.startsWith("weekly-")) return false
  const [row] = await prisma.$queryRaw<{ enabled: boolean }[]>`SELECT COALESCE((to_jsonb(m)->>'weeklyPlannerEnabled')::boolean, false) AS enabled FROM "calendar_events" e JOIN "modules" m ON m."id" = e."moduleId" WHERE e."id" = ${eventId}`
  return row?.enabled === false
}
