import { toPlainText } from "@/lib/plain-text"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { PublicShell } from "@/components/public/public-shell"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { coursesForModule, getPublicModule } from "@/lib/public-notes"
import { SITE_NAME } from "@/lib/site"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ moduleId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const mod = await getPublicModule((await params).moduleId)
  if (!mod) return { title: `Not found | ${SITE_NAME}` }
  return {
    title: `${mod.title} study notes | ${SITE_NAME}`,
    description: toPlainText(mod.description) || `Free study notes for ${mod.title}, organised by chapter and topic.`,
    alternates: { canonical: `/notes/m/${mod.id}` },
  }
}

export default async function PublicModulePage({ params }: Props) {
  const mod = await getPublicModule((await params).moduleId)
  if (!mod) notFound()
  const courses = await coursesForModule(mod.id)
  // One course: show it in the trail. Several: list them under the title instead.
  const courseCrumb = courses.length === 1 ? [{ label: courses[0].title, href: `/notes#course-${courses[0].id}` }] : []

  return (
    <PublicShell ads>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <Breadcrumbs className="px-0" items={[{ label: "Study notes", href: "/notes" }, ...courseCrumb, { label: mod.title }]} />
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{mod.title}</h1>
        {toPlainText(mod.description) && <p className="mt-3 text-muted-foreground">{toPlainText(mod.description)}</p>}
        {courses.length > 1 && (
          <p className="mt-2 text-sm text-muted-foreground">
            Part of{" "}
            {courses.map((c, i) => (
              <span key={c.id}>
                {i > 0 && (i === courses.length - 1 ? " and " : ", ")}
                <Link href={`/notes#course-${c.id}`} className="font-medium text-foreground hover:underline">
                  {c.title}
                </Link>
              </span>
            ))}
          </p>
        )}

        <div className="mt-10 space-y-8">
          {mod.chapters.map((chapter, ci) => (
            <section key={chapter.id} aria-labelledby={`c-${chapter.id}`}>
              <h2 id={`c-${chapter.id}`} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {chapter.title}
              </h2>
              <ul className="mt-2 divide-y divide-border border-y border-border">
                {chapter.topics.map((topic, ti) => (
                  <li key={topic.id}>
                    <Link href={`/notes/${topic.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-primary">
                      <span>
                        <span className="mr-2 text-sm tabular-nums text-muted-foreground">
                          {ci + 1}.{ti + 1}
                        </span>
                        {topic.title}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </PublicShell>
  )
}
