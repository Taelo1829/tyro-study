"use client"

import { toPlainText } from "@/lib/plain-text"
import { useTerms } from "@/hooks/use-level"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { BarChart3, ChevronRight, UserPlus } from "lucide-react"
import { ChapterProgressBar, MockExamCard, ModuleProgressBar, type ModuleProgressData } from "@/components/progress/progress-report"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { useCourseCrumb } from "@/components/modules/use-course-crumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface ChapterRow {
  id: string
  title: string
  order: number
  _count: { topics: number }
}

interface ModuleDetail {
  id: string
  title: string
  description: string | null
  isEnrolled: boolean
  chapters: ChapterRow[]
}

export default function StudentModulePage() {
  const params = useParams()
  const id = params.id as string
  const courseCrumb = useCourseCrumb(id)
  const t = useTerms()
  const [mod, setMod] = useState<ModuleDetail | null>(null)
  const [joining, setJoining] = useState(false)
  const [progress, setProgress] = useState<ModuleProgressData | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/modules/${id}`)
    if (res.ok) setMod(await res.json())
    const prog = await fetch(`/api/progress/module/${id}`).catch(() => null)
    if (prog?.ok) setProgress(await prog.json())
  }, [id])

  useEffect(() => {
    queueMicrotask(load)
  }, [load])

  async function joinModule() {
    setJoining(true)
    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId: id }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to join")
      }
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to join")
    } finally {
      setJoining(false)
    }
  }

  if (!mod) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  if (!mod.isEnrolled) {
    return (
      <>
        <Breadcrumbs items={[{ label: t.Modules, href: "/modules?tab=browse" }, ...courseCrumb, { label: mod.title }]} />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            {toPlainText(mod.description) && (
              <p className="max-w-md text-sm text-muted-foreground">
                {toPlainText(mod.description)}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Join this module to view chapters, topics, and quizzes.
            </p>
            <Button variant="primary" disabled={joining} onClick={joinModule}>
              <UserPlus className="h-4 w-4" />
              {joining ? "Joining…" : "Join module"}
            </Button>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      <Breadcrumbs items={[{ label: `My ${t.modules}`, href: "/modules" }, ...courseCrumb, { label: mod.title }]} />

      {progress && progress.summary.topicsWithQuiz > 0 && (
        <div className="mb-6 space-y-4">
          <Link href={`/modules/${id}/progress`} className="block rounded-[1.5rem] border border-border bg-white px-5 py-4 hover:border-foreground">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 font-semibold">
                <BarChart3 className="h-4 w-4" />
                Your progress
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                Details
                <ChevronRight className="h-4 w-4" />
              </span>
            </div>
            <ModuleProgressBar module={progress} />
            <p className="mt-1 text-xs text-muted-foreground">
              {progress.summary.quizzesTaken} quizzes taken · {progress.summary.quizzesFailed} failed
            </p>
          </Link>
          <MockExamCard data={progress} moduleHref={`/modules/${id}`} />
        </div>
      )}

      {mod.chapters.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No chapters published yet.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {mod.chapters.map((ch) => {
            const chProgress = progress?.chapters.find(c => c.id === ch.id)
            return (
            <li key={ch.id}>
              <Card>
                <Link href={`/modules/${id}/chapters/${ch.id}`}>
                  <CardContent className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{ch.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {ch._count.topics} topic{ch._count.topics !== 1 ? "s" : ""}
                      </p>
                      {chProgress && <ChapterProgressBar chapter={chProgress} className="mt-2.5 max-w-md" />}
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Link>
              </Card>
            </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
