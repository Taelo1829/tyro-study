import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { PublicShell } from "@/components/public/public-shell"
import { listPublicModules } from "@/lib/public-notes"
import { SITE_NAME } from "@/lib/site"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: `Free study notes for UNISA modules | ${SITE_NAME}`,
  description:
    "Free, plain-English study notes for UNISA modules: worked examples, key ideas and common mistakes, organised by chapter and topic.",
  alternates: { canonical: "/notes" },
}

export default async function NotesIndexPage() {
  const modules = await listPublicModules()

  return (
    <PublicShell ads={modules.length > 0}>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Study notes</h1>
        <p className="mt-3 text-muted-foreground">
          Free lessons for UNISA modules, written for distance learners: clear explanations, worked examples, key ideas and
          the mistakes to avoid. Sign up to practise each topic with quizzes and flashcards.
        </p>

        {modules.length === 0 ? (
          <p className="mt-10 text-muted-foreground">Notes are being written — check back soon.</p>
        ) : (
          <div className="mt-10 space-y-12">
            {modules.map(mod => (
              <section key={mod.id} aria-labelledby={`m-${mod.id}`}>
                <h2 id={`m-${mod.id}`} className="text-xl font-semibold tracking-tight">{mod.title}</h2>
                {mod.description && <p className="mt-1 text-sm text-muted-foreground">{mod.description}</p>}
                <div className="mt-4 space-y-6">
                  {mod.chapters.map(chapter => (
                    <div key={chapter.id}>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{chapter.title}</h3>
                      <ul className="mt-2 divide-y divide-border border-y border-border">
                        {chapter.topics.map(topic => (
                          <li key={topic.id}>
                            <Link href={`/notes/${topic.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-primary">
                              <span>{topic.title}</span>
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </PublicShell>
  )
}
