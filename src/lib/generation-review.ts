import type { GenerationJob } from "./generation-types"

/** Prepare only supported review actions. Existing save APIs enforce validation. */
export function generationReviewAction(job: GenerationJob): { path: string; method: string; body: unknown; label: string } | null {
  if (job.status !== "COMPLETED") return null
  const first = job.results[0]
  if (!first) return null
  const data = first.data as Record<string, unknown>
  if (job.results.every(r => r.task.path === "/api/admin/papers/lesson" && r.task.options?.syncExistingPapers === true && r.task.body.moduleId === first.task.body.moduleId)) return {
    path: `/api/admin/modules/${first.task.body.moduleId}/sync-papers`, method: "POST", label: "Apply reviewed paper lesson updates",
    body: { action: "save", jobId: job.id },
  }
  if (job.results.length === 1 && first.task.path === "/api/ai/generate-lesson") return {
    path: `/api/topics/${first.task.body.topicId}`, method: "PATCH", body: { content: data.html }, label: "Replace this topic's lesson with the reviewed draft",
  }
  if (job.results.length === 1 && first.task.path === "/api/ai/generate-questions") return {
    path: "/api/questions", method: "POST", body: { topicId: first.task.body.topicId, chapterId: first.task.body.chapterId, questions: data.questions }, label: "Add these reviewed questions",
  }
  if (first.task.continueWith === "assignment-lessons") return {
    path: first.task.path, method: "POST", label: "Save the assignment and replace its targeted lessons",
    body: { action: "save", source: first.task.body.source, title: data.title, matches: data.matches, questions: data.questions, lessons: job.results.slice(1).map(r => r.data) },
  }
  if (first.task.continueWith === "recreate-lessons") {
    const exam = job.results.find(r => r.task.body.action === "exam")?.data as { exam: unknown; reason: string } | undefined
    const lessons = job.results.filter(r => r.task.body.action === "draft").map(r => r.data as Record<string, unknown>).filter(d => !d.skipped)
    return { path: first.task.path, method: "POST", label: "Replace the reviewed lessons and save the reviewed mock-exam decision", body: { action: "save", lessons, sources: first.task.body.sources, referenceIndex: first.task.options?.referenceIndex ?? -1, assessment: { ...(exam ?? { exam: null, reason: "No previous exam was selected." }), confirmed: true } } }
  }
  if (job.results.every(r => r.task.path === "/api/admin/papers/lesson")) return {
    path: "/api/admin/papers/save", method: "POST", label: "Add the paper questions and replace the reviewed lessons",
    body: { moduleId: first.task.body.moduleId, paper: (first.task.body.source as { name: string }).name, questions: job.results.flatMap(r => r.task.body.questions as unknown[]), lessons: job.results.map(r => r.data) },
  }
  return null
}
