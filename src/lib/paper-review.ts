import type { GenerationJob } from "./generation-types"

export function paperReviewResult(job: Pick<GenerationJob, "status" | "tasks" | "results">, moduleId?: string) {
  if (job.status !== "COMPLETED") return null
  const task = job.tasks[0]
  if (task?.path !== "/api/admin/papers/read" || typeof task.body.moduleId !== "string" || (moduleId && task.body.moduleId !== moduleId)) return null
  // Scanned PDFs finish with an OCR continuation rather than the initial read.
  const result = [...job.results].reverse().find(result => {
    if (!result.data || typeof result.data !== "object") return false
    const data = result.data as Record<string, unknown>
    return Array.isArray(data.questions) && data.questions.length > 0 && Array.isArray(data.topics) && !!data.source
  })
  return result ? { moduleId: task.body.moduleId, data: result.data } : null
}
