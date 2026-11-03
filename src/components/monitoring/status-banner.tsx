/**
 * Site-wide notice during an incident or planned work, e.g.
 *   STATUS_MESSAGE="Study reminders are delayed this morning. Quizzes and lessons work normally."
 * Set it in Vercel (Production) and redeploy; remove it and redeploy when resolved.
 * STATUS_LEVEL=warning (default) or info. Server component: no client JavaScript.
 */
export function StatusBanner() {
  const message = process.env.STATUS_MESSAGE?.trim()
  if (!message) return null
  const info = process.env.STATUS_LEVEL === "info"
  return (
    <div
      role="status"
      className={
        info
          ? "w-full bg-sky-100 px-4 py-2 text-center text-sm text-sky-950"
          : "w-full bg-amber-100 px-4 py-2 text-center text-sm text-amber-950"
      }
    >
      {message.slice(0, 300)}
    </div>
  )
}
