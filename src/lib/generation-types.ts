export interface GenerationTask {
  path: string
  body: Record<string, unknown>
  label?: string
  // Used only by supported, explicit generation workflows.
  continueWith?: "module-topics" | "assignment-lessons" | "recreate-lessons"
  options?: Record<string, unknown>
}
export interface GenerationJob {
  id: string
  userId: string
  title: string
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED"
  tasks: GenerationTask[]
  results: { task: GenerationTask; data: unknown }[]
  cursor: number
  error: string | null
  leaseToken: string | null
  createdAt: string
  updatedAt: string
  notified: boolean
}

const fixed = new Set([
  "/api/ai/generate-lesson", "/api/ai/generate-questions", "/api/ai/generate-flashcards", "/api/ai/find-video",
  "/api/admin/textbooks/analyze", "/api/admin/textbooks/generate-topic", "/api/admin/textbooks/create",
  "/api/modules/build", "/api/modules/build/topic", "/api/admin/papers/read", "/api/admin/papers/lesson",
  "/api/ai/extract-questions", "/api/admin/textbooks/ocr-pdf-page", "/api/generation/finish-ocr",
])
export function isGenerationTask(task: unknown): task is GenerationTask {
  if (!task || typeof task !== "object") return false
  const t = task as GenerationTask
  if (typeof t.path !== "string" || !t.body || typeof t.body !== "object" || Array.isArray(t.body)) return false
  if (t.continueWith && !["module-topics", "assignment-lessons", "recreate-lessons"].includes(t.continueWith)) return false
  if (t.options && (typeof t.options !== "object" || Array.isArray(t.options))) return false
  if (fixed.has(t.path)) return true
  if (/^\/api\/topics\/[^/?#]+\/(exercises|projects)\/generate$/.test(t.path)) return true
  if (/^\/api\/courses\/[^/?#]+\/(discover|import-module)$/.test(t.path)) return true
  if (/^\/api\/admin\/modules\/[^/?#]+\/tutorial-letter$/.test(t.path)) return ["plan", "draft", "draft-all"].includes(String(t.body.action))
  if (/^\/api\/admin\/modules\/[^/?#]+\/recreate-content$/.test(t.path)) return ["assignments", "exam", "draft"].includes(String(t.body.action))
  if (/^\/api\/admin\/modules\/[^/?#]+\/assignments$/.test(t.path)) return ["draft", "lesson"].includes(String(t.body.action))
  return false
}
