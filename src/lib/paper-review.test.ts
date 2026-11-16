import { expect, it } from "vitest"
import { paperReviewResult } from "./paper-review"
import type { GenerationJob } from "./generation-types"
const read = { path: "/api/admin/papers/read", body: { moduleId: "module" } }
const data = { source: { text: "Paper text", name: "Exam" }, questions: [{ question: "Question" }], topics: [{ id: "topic" }] }
const job: Pick<GenerationJob, "status" | "tasks" | "results"> = { status: "COMPLETED", tasks: [read], results: [{ task: read, data }] }
it("restores completed questions only for their own module", () => {
  expect(paperReviewResult(job, "module")).toEqual({ moduleId: "module", data })
  expect(paperReviewResult(job, "other")).toBeNull()
  expect(paperReviewResult({ ...job, status: "RUNNING" })).toBeNull()
  expect(paperReviewResult({ ...job, status: "FAILED" })).toBeNull()
})
it("uses the final scanned-paper results instead of the OCR placeholder", () => {
  const ocr = { path: "/api/generation/finish-ocr", body: {} }
  expect(paperReviewResult({ ...job, tasks: [read, ocr], results: [{ task: read, data: { needsOcr: true } }, { task: ocr, data }] })?.data).toEqual(data)
  expect(paperReviewResult({ ...job, results: [{ task: read, data: { needsOcr: true } }] })).toBeNull()
})
it("does not treat lesson drafts or empty results as question review", () => {
  expect(paperReviewResult({ ...job, tasks: [{ path: "/api/admin/papers/lesson", body: { moduleId: "module" } }] })).toBeNull()
  expect(paperReviewResult({ ...job, results: [{ task: read, data: { ...data, questions: [] } }] })).toBeNull()
})
