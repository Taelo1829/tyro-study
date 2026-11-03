export const DAILY_GOALS = [5, 10, 20] as const
export type OnboardingInput =
  | { step: 0; moduleIds: string[] }
  | { step: 1; deadline: { moduleId: string; type: "EXAM" | "ASSIGNMENT"; date: string } | null }
  | { step: 2; dailyGoal: number }

export function todayInSA(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(now)
}

export function parseOnboardingInput(value: unknown, today = todayInSA()): OnboardingInput {
  if (!value || typeof value !== "object") throw new Error("Choose a setup step.")
  const body = value as Record<string, unknown>
  if (body.step === 0) {
    if (!Array.isArray(body.moduleIds) || body.moduleIds.length > 100 || body.moduleIds.some(id => typeof id !== "string" || !id.trim())) {
      throw new Error("Choose valid modules.")
    }
    return { step: 0, moduleIds: [...new Set(body.moduleIds as string[])] }
  }
  if (body.step === 1) {
    if (body.deadline === null) return { step: 1, deadline: null }
    if (!body.deadline || typeof body.deadline !== "object") throw new Error("Add a date or choose to add it later.")
    const d = body.deadline as Record<string, unknown>
    if (typeof d.moduleId !== "string" || !d.moduleId || (d.type !== "EXAM" && d.type !== "ASSIGNMENT")) throw new Error("Choose a module and deadline type.")
    if (typeof d.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) throw new Error("Choose a valid date.")
    const date = new Date(`${d.date}T00:00:00Z`)
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== d.date || d.date < today) throw new Error("Choose today or a future date.")
    return { step: 1, deadline: { moduleId: d.moduleId, type: d.type, date: d.date } }
  }
  if (body.step === 2 && DAILY_GOALS.includes(body.dailyGoal as 5 | 10 | 20)) return { step: 2, dailyGoal: body.dailyGoal as number }
  throw new Error("Choose a daily goal of 5, 10 or 20 questions.")
}
