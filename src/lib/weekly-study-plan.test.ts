import { expect, it } from "vitest"
import { buildWeeklyStudyPlan, studyDate, studyWeekEnd, validStudyDate } from "./weekly-study-plan"
import type { TutorialGuide } from "./tutorial-letter-types"
const guide: TutorialGuide = { sourceName: "Letter.pdf", year: "2022", moduleCode: "COS2621", book: "Book", contentsSource: "Contents", notes: [], warnings: [], assessments: [], studyPlan: [{ period: "Weeks 1–8", reading: "Chapters 1 and 9", evidence: "quote" }, { period: "Week 8-12", reading: "Chapter 2 and Appendix B", evidence: "quote" }] }
it("creates weekly goals in source order and merges overlapping boundary weeks", () => {
  const plan = buildWeeklyStudyPlan(guide, "2027-01-04")
  expect(plan).toHaveLength(12)
  expect(plan[0].date).toBe("2027-01-04")
  expect(plan[7].notes).toContain("Chapters 1 and 9")
  expect(plan[7].notes).toContain("Chapter 2 and Appendix B")
  expect(plan[11].date).toBe("2027-03-22")
  expect(plan[0].notes).toContain("stage 1 of 8")
  expect(plan[0].notes).toContain("not an official submission deadline")
})
it("supports single weeks, spaced ranges and gaps without inventing reading", () => {
  const plan = buildWeeklyStudyPlan({ ...guide, studyPlan: [{ period: "Week 1", reading: "First", evidence: "" }, { period: "Weeks 3 to 4", reading: "Later", evidence: "" }] }, "2027-01-04")
  expect(plan.map(p => p.week)).toEqual([1, 3, 4])
})
it("rejects impossible dates and unspecified or excessive periods", () => {
  expect(validStudyDate("2027-02-29")).toBe(false)
  expect(validStudyDate("2028-02-29")).toBe(true)
  expect(validStudyDate("2027-13-01")).toBe(false)
  for (const period of ["Revision", "Weeks 4-1", "Weeks 0-5", "Weeks 1-999"]) expect(() => buildWeeklyStudyPlan({ ...guide, studyPlan: [{ period, reading: "Reading", evidence: "" }] }, "2027-01-04")).toThrow()
})
it("uses calendar dates consistently across year and daylight-saving boundaries", () => {
  expect(studyDate("2026-12-28", 1)).toBe("2027-01-04")
  expect(studyDate("2027-03-28", 1)).toBe("2027-04-04")
  expect(studyWeekEnd("2027-01-04")).toBe("2027-01-10")
})
