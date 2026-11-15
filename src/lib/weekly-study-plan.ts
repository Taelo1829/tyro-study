import type { TutorialGuide } from "./tutorial-letter-types"

export interface WeeklyStudyTask {
  week: number; title: string; notes: string; date: string
}
export interface SavedStudyTask { id: string; title: string; notes: string; date: string; completed: boolean; reminders: boolean }
export function validStudyDate(value: unknown): value is string {
  return typeof value === "string" && /^20\d{2}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}
export function studyDate(start: string, weeks: number) {
  if (!validStudyDate(start)) throw new Error("Choose a valid start date.")
  const date = new Date(`${start}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + weeks * 7)
  return date.toISOString().slice(0, 10)
}
export function studyToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
}
export function studyWeekEnd(start: string) {
  const date = new Date(`${start}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 6)
  return date.toISOString().slice(0, 10)
}
/** Use the letter's week ranges, never its historical calendar year. */
export function buildWeeklyStudyPlan(guide: TutorialGuide, startDate: string): WeeklyStudyTask[] {
  if (!validStudyDate(startDate)) throw new Error("Choose a valid start date.")
  if (!guide.studyPlan.length) throw new Error("This tutorial letter has no study schedule yet.")
  const weeks = new Map<number, string[]>()
  for (const block of guide.studyPlan) {
    const range = block.period.trim().match(/^(?:weeks?\s*)?(\d+)(?:\s*(?:[-–—]|to)\s*(\d+))?(?:\s|$)/i)
    if (!range) throw new Error(`The schedule period “${block.period}” needs a numbered week range. Ask an admin to update the tutorial-letter study plan.`)
    const first = Number(range[1]); const last = Number(range[2] ?? range[1])
    if (first < 1 || last < first || last > 104) throw new Error("Study periods must be between weeks 1 and 104.")
    for (let week = first; week <= last; week++) {
      const stage = week - first + 1; const count = last - first + 1
      const goal = count === 1 ? "Work through the listed reading and activities." : stage === count ? "Finish this reading block, review your weak areas and complete its listed activities." : `Work through the next portion of this reading block (stage ${stage} of ${count}); practise the examples and take the relevant topic quizzes.`
      const lines = weeks.get(week) ?? []
      lines.push(`${block.period}: ${block.reading}\n${goal}`)
      weeks.set(week, lines)
    }
  }
  return [...weeks].sort(([a], [b]) => a - b).map(([week, readings]) => ({
    week, title: `Week ${week}: ${guide.moduleCode} study goal`, date: studyDate(startDate, week - 1),
    notes: `${readings.join("\n\n")}\n\nSource: ${guide.sourceName} (${guide.year}). Personal study target, not an official submission deadline. Confirm current requirements with your institution.`,
  }))
}
