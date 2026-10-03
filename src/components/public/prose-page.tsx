import { PublicShell } from "./public-shell"

/** Simple readable page for About / Privacy / Terms */
export function ProsePage({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <PublicShell>
      <article className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {updated && <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>}
        <div className="topic-content topic-article mt-8">{children}</div>
      </article>
    </PublicShell>
  )
}
