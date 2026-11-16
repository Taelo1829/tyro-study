"use client"

import { toPlainText } from "@/lib/plain-text"
import { CODING_LANGUAGES } from "@/lib/coding-shared"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Activity, BookOpen, ChevronRight, FileUp, Plus } from "lucide-react"
import { Header } from "@/components/layout/header"
import { EntityForm } from "@/components/admin/entity-form"
import { TextbookUploader } from "@/components/admin/textbook-uploader"
import { TutorialLetterImporter } from "@/components/admin/tutorial-letter-importer"
import { PaperUploader } from "@/components/admin/paper-uploader"
import { SyncPaperLessons } from "@/components/admin/sync-paper-lessons"
import { UploadedAssignmentList } from "@/components/admin/uploaded-assignment-list"
import { UploadModuleAssignment } from "@/components/admin/upload-module-assignment"
import { ModuleContentRecreator } from "@/components/admin/module-content-recreator"
import { ModuleExerciseBuilder } from "@/components/admin/module-exercise-builder"
import { EditModuleButton } from "@/components/admin/edit-module-button"
import { DeleteModuleButton } from "@/components/admin/delete-module-button"
import { ModulePublishControl } from "@/components/admin/module-publish-control"
import { WeeklyPlannerControl } from "@/components/admin/weekly-planner-control"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ChapterRow {
  assignmentCheckpoints?: { id: string; title: string }[]
  id: string
  title: string
  order: number
  _count: { topics: number }
  /** Topics in this chapter with no written lesson yet */
  topicsWithoutContent?: number
}

interface ModuleDetail {
  id: string
  title: string
  description: string | null
  courses?: { id: string; title: string }[]
  coding?: { language: string | null; auto: boolean } | null
  level?: "tertiary" | "highschool"
  chapters: ChapterRow[]
}

export default function AdminModuleDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [mod, setMod] = useState<ModuleDetail | null>(null)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/modules/${id}`)
    if (res.ok) setMod(await res.json())
  }, [id])

  useEffect(() => {
    queueMicrotask(load)
  }, [load])

  if (!mod) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  return (
    <>
      <Header title={mod.title} subtitle={toPlainText(mod.description) || "Chapters in this module"} />

      <p className="-mt-2 mb-4 text-sm text-muted-foreground">
        {mod.courses?.length ? (
          <>
            In{" "}
            {mod.courses.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ", "}
                <Link href="/admin/courses" className="font-medium text-foreground hover:underline">{c.title}</Link>
              </span>
            ))}
          </>
        ) : (
          <>Not in a course yet. Add it with Edit module.</>
        )}
        {mod.level === "highschool" && <span className="ml-1">· High school subject</span>}
        {mod.coding?.language && (
          <span className="ml-1">
            · Coding module ({CODING_LANGUAGES[mod.coding.language as keyof typeof CODING_LANGUAGES]?.label ?? mod.coding.language}): topics get coding projects and &ldquo;Try it yourself&rdquo; exercises
          </span>
        )}
      </p>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/modules"
          className="text-sm text-muted-foreground hover:text-primary"
        >
          ← Modules
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/admin/generation"><Activity className="h-4 w-4" />Generation progress</Link>
          </Button>
          <EditModuleButton
            module={mod}
            onSaved={updated => setMod(prev => (prev ? { ...prev, ...updated } : prev))}
            chapterCount={mod.chapters.length}
            topicCount={mod.chapters.reduce((n, c) => n + c._count.topics, 0)}
          />
        </div>
      </div>

      <div className="mb-6 grid items-start gap-4 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><FileUp className="h-4 w-4 text-primary" />Upload materials</CardTitle>
            <p className="text-sm text-muted-foreground">Add source documents, assessments and question papers.</p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <ModuleAction><TutorialLetterImporter moduleId={id} onSaved={load} /></ModuleAction>
            <ModuleAction><TextbookUploader moduleId={id} onUploaded={load} /></ModuleAction>
            <ModuleAction><PaperUploader moduleId={id} onAdded={load} /></ModuleAction>
            <ModuleAction><UploadModuleAssignment moduleId={id} onSaved={load} /></ModuleAction>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4 text-primary" />Update learning content</CardTitle>
            <p className="text-sm text-muted-foreground">Refresh lessons and review generated content.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <ModuleAction><SyncPaperLessons moduleId={id} /></ModuleAction>
            <p className="text-xs text-muted-foreground">Use papers already uploaded to this module to prepare lesson updates.</p>
            <ModuleAction><ModuleContentRecreator moduleId={id} onSaved={load} /></ModuleAction>
            {mod.coding?.language && <ModuleAction><ModuleExerciseBuilder moduleId={id} /></ModuleAction>}
          </CardContent>
        </Card>
      </div>

      <ModulePublishControl moduleId={id} />
      <WeeklyPlannerControl key={id} moduleId={id} />
      <UploadedAssignmentList moduleId={id} onDeleted={load} assignments={mod.chapters.flatMap(ch => (ch.assignmentCheckpoints ?? []).filter(a => /^assignment-[a-f0-9]{40}$/.test(a.id)).map(a => ({ ...a, chapter: ch.title })))} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Chapters <span className="text-sm font-normal text-muted-foreground">({mod.chapters.length})</span></h2>
        <Button variant="primary" size="sm" aria-expanded={showForm} onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" />New chapter
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create chapter</CardTitle>
          </CardHeader>
          <CardContent>
            <EntityForm
              fields={[{ name: "title", label: "Chapter title", required: true }]}
              submitLabel="Create chapter"
              onCancel={() => setShowForm(false)}
              onSubmit={async (values) => {
                const res = await fetch("/api/chapters", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ moduleId: id, title: values.title }),
                })
                if (!res.ok) {
                  const data = await res.json()
                  throw new Error(data.error ?? "Failed")
                }
                // Show the new chapter straight away, then sync in the background
                const created = (await res.json()) as Omit<ChapterRow, "_count">
                setMod(prev =>
                  prev && !prev.chapters.some(c => c.id === created.id)
                    ? { ...prev, chapters: [...prev.chapters, { ...created, _count: { topics: 0 } }] }
                    : prev
                )
                setShowForm(false)
                void load()
              }}
            />
          </CardContent>
        </Card>
      )}

      <ul className="space-y-3">
        {mod.chapters.map((ch) => (
          <li key={ch.id}>
            <Link href={`/admin/chapters/${ch.id}`}>
              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-semibold">{ch.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {ch._count.topics} topic{ch._count.topics !== 1 ? "s" : ""}
                    </p>
                    {!!ch.topicsWithoutContent && (
                      <p className="mt-0.5 text-xs font-medium text-red-600">
                        {ch.topicsWithoutContent} topic{ch.topicsWithoutContent !== 1 ? "s" : ""} without content
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      <details className="mt-8 rounded-xl border border-border p-4">
        <summary className="cursor-pointer text-sm font-medium">Delete module</summary>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Permanently remove this module and its content.</p>
          <DeleteModuleButton module={mod} chapterCount={mod.chapters.length} topicCount={mod.chapters.reduce((n, c) => n + c._count.topics, 0)} />
        </div>
      </details>
    </>
  )
}

function ModuleAction({ children }: { children: ReactNode }) {
  return <div className="min-w-0 [&>button]:h-auto [&>button]:min-h-10 [&>button]:w-full [&>button]:justify-start [&>button]:whitespace-normal [&>button]:text-left [&>div>button]:h-auto [&>div>button]:min-h-10 [&>div>button]:w-full [&>div>button]:justify-start [&>div>button]:whitespace-normal [&>div>button]:text-left">{children}</div>
}
