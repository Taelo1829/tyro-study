import { describe, expect, it } from "vitest"
import { validateExamDraft, examValidationPayload } from "./exam-structure"
const source = { name: "exam.pdf", text: `Final examination
Duration: 120 minutes
2 questions, 4 marks
Answer all questions.
Each question is worth 2 marks.
Section A
1. What is 2 + 2?
4
5
Section B
2. What is 3 + 3?
6
7` }
const draft = () => ({ isExam: true, supported: true, examEvidence: "Final examination", durationMinutes: 120, durationEvidence: "Duration: 120 minutes", totalQuestions: 2, totalMarks: 4, totalsEvidence: "2 questions, 4 marks", instructions: "Answer all questions.", sections: [
  { title: "Section A", instructions: "", questions: [{ kind: "mcq", label: "1", labelEvidence: "1. What is 2 + 2?", question: "What is 2 + 2?", options: ["4", "5"], correctOption: "4", marks: 2, marksEvidence: "Each question is worth 2 marks." }] },
  { title: "Section B", instructions: "", questions: [{ kind: "mcq", label: "2", labelEvidence: "2. What is 3 + 3?", question: "What is 3 + 3?", options: ["6", "7"], correctOption: "6", marks: 2, marksEvidence: "Each question is worth 2 marks." }] },
] })
describe("past paper structural validation", () => {
  it("preserves sections, numbering, marks, options and duration verbatim", () => {
    const exam = validateExamDraft(draft(), source)
    expect(exam.sections.map(s => s.title)).toEqual(["Section A", "Section B"])
    expect(exam.sections.flatMap(s => s.questions.map(q => q.label))).toEqual(["1", "2"])
    expect(exam.durationMinutes).toBe(120)
    expect(exam.totalMarks).toBe(4)
    expect(validateExamDraft(examValidationPayload(exam), source)).toEqual(exam)
  })
  it("refuses assignments and unsupported source formats", () => {
    expect(() => validateExamDraft({ ...draft(), isExam: false }, source)).toThrow("unavailable")
    expect(() => validateExamDraft({ ...draft(), supported: false, reason: "Essay section" }, source)).toThrow("Essay section")
    const d = draft(); d.sections[1].questions[0].kind = "essay"
    expect(() => validateExamDraft(d, source)).toThrow("cannot be converted")
  })
  it("refuses missing or invented duration and structure", () => {
    expect(() => validateExamDraft({ ...draft(), durationMinutes: 60 }, source)).toThrow("duration")
    expect(() => validateExamDraft({ ...draft(), instructions: "Make up a format" }, source)).toThrow("verified")
    const d = draft(); d.sections[0].title = "Invented section"
    expect(() => validateExamDraft(d, source)).toThrow("verified")
  })
  it("refuses shortened or reordered papers", () => {
    const d = draft(); d.sections.pop()
    expect(() => validateExamDraft(d, source)).toThrow("do not add up")
    expect(() => validateExamDraft({ ...draft(), sections: draft().sections.reverse() }, source)).toThrow("order")
  })
  it("refuses reordered answer options", () => {
    const d = draft(); d.sections[0].questions[0].options.reverse()
    expect(() => validateExamDraft(d, source)).toThrow("options")
  })
  it("refuses optional instructions rather than approximating them", () => {
    const text = source.text.replace("Answer all questions.", "Answer only one question.")
    expect(() => validateExamDraft({ ...draft(), instructions: "Answer only one question." }, { ...source, text })).toThrow("optional")
  })
})
