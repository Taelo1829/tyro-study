import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { BookOpen, CalendarDays, ChevronRight, Layers, ListChecks, MessageCircle } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { PublicShell } from "@/components/public/public-shell"
import { listPublicModules } from "@/lib/public-notes"
import { SITE_NAME } from "@/lib/site"

/**
 * Public home page. Rendered on the server so search engines (and AdSense
 * review) see real content instead of a redirect to /login. Signed-in users go
 * straight to their dashboard.
 */

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: `${SITE_NAME} – study notes, quizzes and flashcards for UNISA modules`,
  description:
    "Free study notes for UNISA modules, plus practice quizzes, flashcards and a study timetable to help distance learners prepare for assignments and exams.",
  alternates: { canonical: "/" },
}

const FEATURES = [
  {
    icon: BookOpen,
    title: "Lessons in plain English",
    text: "Each topic is explained step by step with worked examples, key ideas and the mistakes students often make in assignments and exams.",
  },
  {
    icon: ListChecks,
    title: "Practice quizzes",
    text: "Multiple-choice quizzes for every topic and chapter, with instant feedback and a list of the topics to revise when you get something wrong.",
  },
  {
    icon: Layers,
    title: "Flashcards",
    text: "Quick flashcards for definitions and key facts, so you can revise in short sessions between work and family.",
  },
  {
    icon: CalendarDays,
    title: "Study timetable",
    text: "Plan study sessions and keep assignment and exam dates in one calendar, with today's plan on your dashboard.",
  },
  {
    icon: MessageCircle,
    title: "Study with friends",
    text: "Chat with classmates taking the same modules — share notes, voice notes and questions.",
  },
]

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  if (session?.user?.id) redirect("/dashboard")

  const modules = await listPublicModules()

  return (
    <PublicShell ads={modules.length > 0}>
      {/* Intro */}
      <section className="mx-auto max-w-3xl px-4 pb-12 pt-14 text-center sm:pt-20">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Study smarter for your UNISA modules
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          {SITE_NAME} gives distance learners clear study notes for each topic, then helps you check your understanding with
          quizzes and flashcards — so you walk into assignments and exams prepared.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/notes" className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/85">
            Read the study notes
          </Link>
          <Link href="/register" className="rounded-full px-6 py-3 font-medium ring-1 ring-border hover:bg-muted">
            Create a free account
          </Link>
        </div>
      </section>

      {/* What it does */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-2xl font-semibold tracking-tight">What you can do</h2>
          <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(f => (
              <div key={f.title}>
                <f.icon className="h-5 w-5" aria-hidden="true" />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free notes by module */}
      {modules.length > 0 && (
        <section className="border-t border-border">
          <div className="mx-auto max-w-5xl px-4 py-14">
            <h2 className="text-2xl font-semibold tracking-tight">Free study notes</h2>
            <p className="mt-2 text-muted-foreground">Start reading now — no account needed.</p>
            <ul className="mt-6 divide-y divide-border border-y border-border">
              {modules.map(mod => {
                const first = mod.chapters[0]?.topics[0]
                return (
                  <li key={mod.id}>
                    <Link href={first ? `/notes/${first.id}` : "/notes"} className="flex items-center justify-between gap-4 py-4 hover:text-primary">
                      <div className="min-w-0">
                        <p className="font-medium">{mod.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {mod.topicCount} topic{mod.topicCount !== 1 ? "s" : ""} across {mod.chapters.length} chapter{mod.chapters.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                )
              })}
            </ul>
            <Link href="/notes" className="mt-4 inline-block text-sm font-medium hover:underline">
              See all study notes →
            </Link>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {[
              ["Join your modules", "Pick the UNISA modules you're registered for."],
              ["Work through each topic", "Read the lesson and its study guide pages, then take the topic quiz."],
              ["Revise what you missed", "Your results show which topics to focus on before the exam."],
            ].map(([title, text], i) => (
              <li key={title}>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </PublicShell>
  )
}
