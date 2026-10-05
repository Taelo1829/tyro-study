"use client"

import { toPlainText } from "@/lib/plain-text"
import { CODING_LANGUAGES } from "@/lib/coding-shared"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronRight, Plus } from "lucide-react"
import { Header } from "@/components/layout/header"
import { EntityForm } from "@/components/admin/entity-form"
import { TextbookUploader } from "@/components/admin/textbook-uploader"
import { PaperUploader } from "@/components/admin/paper-uploader"
import { EditModuleButton } from "@/components/admin/edit-module-button"
import { DeleteModuleButton } from "@/components/admin/delete-module-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ChapterRow {
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
        {mod.coding?.language && (
          <span className="ml-1">
            · Coding module ({CODING_LANGUAGES[mod.coding.language as keyof typeof CODING_LANGUAGES]?.label ?? mod.coding.language}): topics get coding projects
          </span>
        )}
      </p>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/modules"
          className="text-sm text-muted-foreground hover:text-primary"
        >
          ← Modules
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <EditModuleButton
            module={mod}
            onSaved={updated => setMod(prev => (prev ? { ...prev, ...updated } : prev))}
            chapterCount={mod.chapters.length}
            topicCount={mod.chapters.reduce((n, c) => n + c._count.topics, 0)}
          />
          <TextbookUploader moduleId={id} onUploaded={load} />
          <PaperUploader moduleId={id} onAdded={load} />
          <Button variant="primary" size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" />
            New chapter
          </Button>
          <DeleteModuleButton
            module={mod}
            chapterCount={mod.chapters.length}
            topicCount={mod.chapters.reduce((n, c) => n + c._count.topics, 0)}
          />
        </div>
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
    </>
  )
}
