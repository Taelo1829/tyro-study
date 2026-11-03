import { describe, expect, it } from "vitest"
import { asLevel, gradeOfTitle, isStudyLevel, termsFor } from "./levels"

describe("study levels", () => {
  it("defaults anything unknown to university (tertiary)", () => {
    expect(asLevel("highschool")).toBe("highschool")
    expect(asLevel("tertiary")).toBe("tertiary")
    expect(asLevel(undefined)).toBe("tertiary")
    expect(asLevel("admin")).toBe("tertiary")
    expect(isStudyLevel("college")).toBe(false)
  })

  it("uses subject/grade words for high school and module/course for university", () => {
    expect(termsFor("highschool")).toMatchObject({ module: "subject", Modules: "Subjects", course: "grade" })
    expect(termsFor("tertiary")).toMatchObject({ module: "module", Modules: "Modules", course: "course" })
    expect(termsFor(null).module).toBe("module")
  })

  it("reads the grade from a high school subject title", () => {
    expect(gradeOfTitle("Physical Sciences - Grade 12")).toBe(12)
    expect(gradeOfTitle("Mathematics grade11")).toBe(11)
    expect(gradeOfTitle("MAT1503 Linear Algebra I")).toBeNull()
  })
})
