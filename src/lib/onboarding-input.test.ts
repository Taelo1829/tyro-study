import { describe, expect, it } from "vitest"
import { parseOnboardingInput, todayInSA } from "./onboarding-input"

const today = "2026-11-03"
describe("onboarding choices", () => {
  it("deduplicates modules and allows an empty catalogue", () => {
    expect(parseOnboardingInput({ step: 0, moduleIds: ["a", "a", "b"] }, today)).toEqual({ step: 0, moduleIds: ["a", "b"] })
    expect(parseOnboardingInput({ step: 0, moduleIds: [] }, today)).toEqual({ step: 0, moduleIds: [] })
  })
  it("rejects malformed selections", () => {
    for (const moduleIds of [null, "a", [null], [3], [""]]) expect(() => parseOnboardingInput({ step: 0, moduleIds }, today)).toThrow()
  })
  it("accepts future exams, assignments, and postponing the date", () => {
    for (const type of ["EXAM", "ASSIGNMENT"]) expect(parseOnboardingInput({ step: 1, deadline: { moduleId: "a", type, date: today } }, today)).toMatchObject({ step: 1 })
    expect(parseOnboardingInput({ step: 1, deadline: null }, today)).toEqual({ step: 1, deadline: null })
  })
  it("rejects past and impossible dates", () => {
    for (const date of ["2026-11-02", "2027-02-30", "2026-13-01", "03/11/2026", "bad"]) expect(() => parseOnboardingInput({ step: 1, deadline: { moduleId: "a", type: "EXAM", date } }, today)).toThrow()
  })
  it("only accepts the supported goal sizes and deadline types", () => {
    for (const dailyGoal of [5, 10, 20]) expect(parseOnboardingInput({ step: 2, dailyGoal }, today)).toEqual({ step: 2, dailyGoal })
    for (const dailyGoal of [0, -1, 10.5, 500, "10", null]) expect(() => parseOnboardingInput({ step: 2, dailyGoal }, today)).toThrow()
    expect(() => parseOnboardingInput({ step: 1, deadline: { moduleId: "a", type: "REMINDER", date: today } }, today)).toThrow()
  })
  it("uses the South African day around midnight UTC", () => {
    expect(todayInSA(new Date("2026-11-02T22:15:00Z"))).toBe(today)
  })
})
