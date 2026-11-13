/** Only return known, safe diagnostics; provider/database details stay in server logs. */
export function recreationFailure(error: unknown, stage: string) {
  const err = error as { code?: string; status?: number; message?: string; meta?: { code?: string } } | null
  const message = typeof err?.message === "string" ? err.message : ""
  if (err?.code === "P2028" && /unable to start a transaction/i.test(message)) return {
    status: 503, error: "The database is busy and could not begin saving this topic. Retry to continue; completed topics are kept.",
  }
  if (err?.code === "P2022" || err?.code === "42703" || err?.meta?.code === "42703") return {
    status: 503, error: "The database needs the assessment update before this content can be saved. Run npx prisma migrate deploy against this app’s database, then retry Save. Keep this window open to retain your drafts.",
  }
  if (/OPENAI_API_KEY/.test(message) || err?.status === 401) return { status: 503, error: "Content generation is not configured correctly. Check the server’s content-generation credentials, then retry. Your existing content is unchanged." }
  if (err?.status === 429) return { status: 503, error: "Content generation is temporarily unavailable because its usage limit was reached. Check the service quota or retry later. Your drafts are kept." }
  if (/incomplete|No content was found|draft was empty/i.test(message)) return { status: 502, error: "The generated draft was incomplete. Retry this topic; completed drafts are kept." }
  return { status: 500, error: stage === "save"
    ? "Couldn’t save the drafts. Nothing was changed. Keep this window open and retry Save; check the server logs if it fails again."
    : "Couldn’t generate this draft. Existing content and completed drafts are kept. Retry this topic; check the server logs if it fails again." }
}
