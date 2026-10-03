import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react"
import { PublicShell } from "@/components/public/public-shell"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { TopicContentView } from "@/components/topic/topic-content-view"
import { getPublicTopic } from "@/lib/public-notes"
import { lessonSummary, renderTopicContentServer } from "@/lib/topic-content-server"
import { readingMinutes } from "@/lib/topic-content"
import { SITE_NAME } from "@/lib/site"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ topicId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const topic = await getPublicTopic((await params).topicId)
  if (!topic) return { title: `Not found | ${SITE_NAME}` }
  return {
    title: `${topic.title} – ${topic.moduleTitle} notes | ${SITE_NAME}`,
    description: lessonSummary(topic.content) || `Study notes for ${topic.title} (${topic.moduleTitle}).`,
    alternates: { canonical: `/notes/${topic.id}` },
  }
}

export default async function PublicLessonPage({ params }: Props) {
  const topic = await getPublicTopic((await params).topicId)
  if (!topic) notFound()

  const html = renderTopicContentServer(topic.content)

  return (
    <PublicShell ads>
      <article className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <Breadcrumbs
          className="px-0"
          items={[
            { label: "Study notes", href: "/notes" },
            { label: topic.moduleTitle, href: `/notes#m-${topic.moduleId}` },
            { label: topic.chapterTitle },
          ]}
        />
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{topic.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {topic.moduleTitle} · {topic.chapterTitle} · {readingMinutes(html)} min read
        </p>

        <div className="mt-8">
          <TopicContentView content={html} serverHtml={html} />
        </div>

        <aside className="mt-12 rounded-2xl bg-muted/60 p-6">
          <p className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4" /> Test yourself on this topic
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a free {SITE_NAME} account to practise with quizzes and flashcards, track your progress and plan your study timetable.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/register" className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/85">
              Get started — it&apos;s free
            </Link>
            <Link href="/login" className="rounded-full px-5 py-2.5 text-sm font-medium ring-1 ring-border hover:bg-white">
              Sign in
            </Link>
          </div>
        </aside>

        <nav aria-label="More notes" className="mt-10 grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
          {topic.previous ? (
            <Link href={`/notes/${topic.previous.id}`} className="group flex flex-col rounded-xl p-3 hover:bg-muted">
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeft className="h-3 w-3" /> Previous</span>
              <span className="font-medium group-hover:text-primary">{topic.previous.title}</span>
            </Link>
          ) : <span />}
          {topic.next && (
            <Link href={`/notes/${topic.next.id}`} className="group flex flex-col rounded-xl p-3 text-right hover:bg-muted sm:col-start-2">
              <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">Next <ArrowRight className="h-3 w-3" /></span>
              <span className="font-medium group-hover:text-primary">{topic.next.title}</span>
            </Link>
          )}
        </nav>
      </article>
    </PublicShell>
  )
}
