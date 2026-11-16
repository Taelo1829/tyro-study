import { expect, it } from "vitest"
import { isGenerationTask } from "./generation-types"
it("allows generation but does not queue review, publish, delete or arbitrary endpoints", () => {
  expect(isGenerationTask({ path: "/api/ai/generate-lesson", body: { topicId: "t" } })).toBe(true)
  expect(isGenerationTask({ path: "/api/admin/modules/m/tutorial-letter", body: { action: "draft-all" } })).toBe(true)
  for (const path of ["https://example.com/api/ai/generate-lesson", "/api/admin/users", "/api/topics/t", "/api/admin/papers/save"]) expect(isGenerationTask({ path, body: {} })).toBe(false)
  expect(isGenerationTask({ path: "/api/admin/modules/m/tutorial-letter", body: { action: "apply", reviewed: true } })).toBe(false)
  expect(isGenerationTask({ path: "/api/admin/modules/m/recreate-content", body: { action: "save" } })).toBe(false)
})
