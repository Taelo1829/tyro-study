import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card } from "@/components/ui/card"
import { FeedbackStatusSelect } from "@/components/feedback/feedback-status-select"
import { cn } from "@/lib/utils"
import { feedbackCounts, isFeedbackStatus, listFeedback } from "@/lib/feedback"
import { requireAdminPage } from "@/lib/admin"

export const dynamic = "force-dynamic"

const KIND_LABELS: Record<string, string> = { bug: "Bug", content: "Content mistake", idea: "Idea", other: "Other" }
const FILTERS = [["open", "Open"], ["new", "New"], ["planned", "Planned"], ["done", "Done"], ["wontfix", "Won't do"], ["all", "All"]] as const
const when = new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" })

/**
 * Feedback inbox (business/12 §5): triage weekly. Bugs → backlog with a
 * regression test; content mistakes → fix the lesson the same week; ideas →
 * scored in the monthly product review.
 */
export default async function AdminFeedbackPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdminPage()
  const { status: raw } = await searchParams
  const status = raw === "all" || raw === "open" || isFeedbackStatus(raw) ? raw : "open"
  const [items, counts] = await Promise.all([listFeedback(status), feedbackCounts(7)])
  const week = counts.reduce((n, c) => n + c.n, 0)

  return (
    <>
      <Header title="Feedback" subtitle="What students are telling us" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/admin" className="mr-2 text-sm text-muted-foreground hover:underline">← Admin</Link>
        {FILTERS.map(([v, l]) => (
          <Link key={v} href={`/admin/feedback?status=${v}`} className={cn("rounded-full px-4 py-1.5 text-sm font-medium ring-1 ring-border", v === status ? "bg-primary text-primary-foreground ring-primary" : "hover:bg-muted")}>{l}</Link>
        ))}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Last 7 days: {week} message{week === 1 ? "" : "s"}
        {counts.length > 0 && <> ({Object.entries(counts.reduce<Record<string, number>>((m, c) => ({ ...m, [c.kind]: (m[c.kind] ?? 0) + c.n }), {})).map(([k, n]) => `${n} ${KIND_LABELS[k]?.toLowerCase() ?? k}`).join(", ")})</>}
      </p>
      {items.length === 0 ? (
        <Card><p className="text-sm text-muted-foreground">Nothing here.</p></Card>
      ) : (
        <div className="space-y-3">
          {items.map(f => (
            <Card key={f.id} className="grid gap-3 sm:grid-cols-[1fr_12rem]">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  <span className="mr-2 rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">{KIND_LABELS[f.kind] ?? f.kind}</span>
                  {when.format(new Date(f.createdAt))}
                  {f.page && <> · <code>{f.page}</code></>}
                  {f.appVersion && <> · v{f.appVersion}</>}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words">{f.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">{f.userName ?? "Deleted account"}{f.userEmail && <> · {f.userEmail}</>}</p>
              </div>
              <FeedbackStatusSelect id={f.id} status={f.status} note={f.adminNote} />
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
