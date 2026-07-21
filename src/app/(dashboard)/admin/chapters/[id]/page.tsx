"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronRight, PlayCircle, Plus } from "lucide-react"
import { Header } from "@/components/layout/header"
import { EntityForm } from "@/components/admin/entity-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface TopicRow {
  id: string
  title: string
  order: number
  _count: { questions: number }
}

interface ChapterDetail {
  id: string
  title: string
  module: { id: string; title: string }
  topics: TopicRow[]
}

export default function AdminChapterDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [chapter, setChapter] = useState<ChapterDetail | null>(null)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/chapters/${id}`)
    if (res.ok) setChapter(await res.json())
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (!chapter) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  return (
    <>
      <Header title={chapter.title} subtitle={chapter.module.title} />

      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/admin/modules/${chapter.module.id}`}
          className="text-sm text-muted-foreground hover:text-primary"
        >
          ← {chapter.module.title}
        </Link>
        <div className="flex gap-2">
          {chapter.topics.some((topic) => topic._count.questions > 0) && <Link href={`/modules/${chapter.module.id}/chapters/${chapter.id}/quiz`}><Button variant="outline" size="sm"><PlayCircle className="h-4 w-4" />Preview quiz</Button></Link>}
          <Button variant="primary" size="sm" onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4" />New topic</Button>
        </div>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create topic</CardTitle>
          </CardHeader>
          <CardContent>
            <EntityForm
              fields={[
                { name: "title", label: "Topic title", required: true },
                {
                  name: "content",
                  label: "Content (optional)",
                  type: "textarea",
                },
              ]}
              submitLabel="Create topic"
              onCancel={() => setShowForm(false)}
              onSubmit={async (values) => {
                const res = await fetch("/api/topics", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chapterId: id,
                    title: values.title,
                    content: values.content,
                  }),
                })
                if (!res.ok) {
                  const data = await res.json()
                  throw new Error(data.error ?? "Failed")
                }
                setShowForm(false)
                await load()
              }}
            />
          </CardContent>
        </Card>
      )}

      <ul className="space-y-3">
        {chapter.topics.map((t) => (
          <li key={t.id}>
            <Link href={`/admin/topics/${t.id}`}>
              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-semibold">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t._count.questions} question
                      {t._count.questions !== 1 ? "s" : ""}
                    </p>
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
