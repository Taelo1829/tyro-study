import { toPlainText } from "@/lib/plain-text"
import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { PublicShell } from "@/components/public/public-shell"
import { NotesSearch } from "@/components/public/notes-search"
import { listPublicModules, searchPublicTopics, type PublicModule } from "@/lib/public-notes"
import { listCourses } from "@/lib/courses"
import { SITE_NAME } from "@/lib/site"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: `Free study notes for UNISA modules | ${SITE_NAME}`,
  description:
    "Free, plain-English study notes for UNISA modules: worked examples, key ideas and common mistakes, organised by chapter and topic.",
  alternates: { canonical: "/notes" },
}

type Props = { searchParams: Promise<{ q?: string | string[] }> }

export default async function NotesIndexPage({ searchParams }: Props) {
  const raw = (await searchParams).q
  const q = (Array.isArray(raw) ? raw[0] : raw ?? "").trim()
  const [modules, results, courses] = await Promise.all([
    listPublicModules(),
    q ? searchPublicTopics(q) : Promise.resolve(null),
    listCourses(),
  ])

  // Course > Module: a module shared by two courses is listed under both
  const byId = new Map(modules.map(m => [m.id, m]))
  const groups = courses
    .map(course => ({
      course,
      modules: course.moduleIds.map(id => byId.get(id)).filter((m): m is PublicModule => !!m),
    }))
    .filter(g => g.modules.length > 0)
  const inCourse = new Set(groups.flatMap(g => g.modules.map(m => m.id)))
  const loose = modules.filter(m => !inCourse.has(m.id))

  return (
    <PublicShell ads={modules.length > 0}>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Study notes</h1>
        <p className="mt-3 text-muted-foreground">
          Free lessons for UNISA modules, written for distance learners: clear explanations, worked examples, key ideas and
          the mistakes to avoid. Sign up to practise each topic with quizzes and flashcards.
        </p>

        {modules.length === 0 ? (
          <p className="mt-10 text-muted-foreground">Notes are being written. Check back soon.</p>
        ) : (
          <>
            <div className="mt-8">
              <NotesSearch key={q} initial={q} />
            </div>

            {results ? (
              <section aria-labelledby="results" className="mt-8">
                <h2 id="results" className="text-sm text-muted-foreground">
                  {results.length === 0
                    ? `No notes match “${q}”.`
                    : `${results.length}${results.length === 40 ? "+" : ""} result${results.length !== 1 ? "s" : ""} for “${q}”`}
                </h2>
                {results.length > 0 && (
                  <ul className="mt-3 divide-y divide-border border-y border-border">
                    {results.map(r => (
                      <li key={r.id}>
                        <Link href={`/notes/${r.id}`} className="group block py-4">
                          <p className="text-xs text-muted-foreground">
                            {r.moduleTitle} / {r.chapterTitle}
                          </p>
                          <p className="mt-0.5 font-medium group-hover:text-primary">{r.title}</p>
                          {r.snippet && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.snippet}</p>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : groups.length === 0 ? (
                <section aria-labelledby="modules" className="mt-8">
                  <h2 id="modules" className="sr-only">Modules</h2>
                  <ModuleList modules={modules} />
                </section>
              ) : (
                <div className="mt-8 space-y-10">
                  {groups.map(({ course, modules: list }) => (
                    <section key={course.id} id={`course-${course.id}`} aria-labelledby={`h-${course.id}`} className="scroll-mt-24">
                      <h2 id={`h-${course.id}`} className="text-xl font-semibold tracking-tight">{course.title}</h2>
                      {toPlainText(course.description) && (
                        <p className="mt-1 text-sm text-muted-foreground">{toPlainText(course.description)}</p>
                      )}
                      <ModuleList modules={list} className="mt-3" />
                    </section>
                  ))}
                  {loose.length > 0 && (
                    <section id="course-other" aria-labelledby="h-other" className="scroll-mt-24">
                      <h2 id="h-other" className="text-xl font-semibold tracking-tight">Other modules</h2>
                      <ModuleList modules={loose} className="mt-3" />
                    </section>
                  )}
                </div>
              )}
          </>
        )}
      </div>
    </PublicShell>
  )
}

function ModuleList({ modules, className = "" }: { modules: PublicModule[]; className?: string }) {
  return (
    <ul className={`divide-y divide-border border-y border-border ${className}`}>
      {modules.map(mod => (
        <li key={mod.id}>
          <Link href={`/notes/m/${mod.id}`} className="group flex items-center justify-between gap-4 py-5">
            <div className="min-w-0">
              <p className="text-lg font-semibold tracking-tight group-hover:text-primary">{mod.title}</p>
              {toPlainText(mod.description) && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{toPlainText(mod.description)}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                {mod.topicCount} topic{mod.topicCount !== 1 ? "s" : ""} · {mod.chapters.length} chapter
                {mod.chapters.length !== 1 ? "s" : ""}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
