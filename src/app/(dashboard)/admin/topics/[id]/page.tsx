"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Header } from "@/components/layout/header"
import { ContentManager } from "@/components/admin/content-manager"
import { TopicPdfManager } from "@/components/admin/topic-pdf-manager"
import { ExcelBulkImport } from "@/components/admin/excel-bulk-import"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface TopicDetail {
  id: string
  title: string
  content: string | null
  chapter: {
    id: string
    title: string
    module: { id: string; title: string }
  }
  questions: {
    id: string
    question: string
    answers: { answer: string; isCorrect: boolean }[]
  }[]
  _count: { flashcards: number }
}

export default function AdminTopicDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [topic, setTopic] = useState<TopicDetail | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/topics/${id}`)
    if (res.ok) setTopic(await res.json())
  }, [id])

  const deleteTopic = useCallback(async () => {
    if (!confirm("Delete this topic?")) return
    setTopic(null)
    const res = await fetch(`/api/topics/${id}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      await res.json().catch(() => null)
      load()
      alert("failed to delete")
    }

    router.back()
  }, [id, load, router])

  useEffect(() => {
    let cancelled = false

    fetch(`/api/topics/${id}`)
      .then((res) => (res.ok ? res.json() as Promise<TopicDetail> : null))
      .then((data) => {
        if (!cancelled && data) setTopic(data)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  if (!topic) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  const breadcrumb = `${topic.chapter.module.title} / ${topic.chapter.title}`

  return (
    <>
      <Header title={topic.title} subtitle={breadcrumb} />

      <Link
        href={`/admin/chapters/${topic.chapter.id}`}
        className="mb-6 inline-block text-sm text-muted-foreground hover:text-primary"
      >
        ← Back to chapter
      </Link>

      <div className="space-y-6">
        <ContentManager
          topicId={id}
          initialContent={topic.content ?? ""}
          onSaved={load}
        />

        <Card>
          <CardHeader>
            <CardTitle>PDF content</CardTitle>
          </CardHeader>
          <CardContent>
            <TopicPdfManager topicId={id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bulk upload questions (Excel)</CardTitle>
          </CardHeader>
          <CardContent>
            <ExcelBulkImport
              topicId={id}
              type="questions"
              onImported={load}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bulk upload flashcards (Excel)</CardTitle>
          </CardHeader>
          <CardContent>
            <ExcelBulkImport
              topicId={id}
              type="flashcards"
              onImported={load}
            />
          </CardContent>
        </Card>
        {topic.questions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>
                Saved questions ({topic.questions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {topic.questions.map((q, i) => (
                <div key={q.id} className="neo-inset rounded-[var(--neo-radius)] p-4">
                  <p className="mb-2 font-medium">
                    {i + 1}. {q.question}
                  </p>
                  <ul className="space-y-1">
                    {q.answers.map((a) => (
                      <li
                        key={a.answer}
                        className={`text-sm ${a.isCorrect
                          ? "font-medium text-accent"
                          : "text-muted-foreground"
                          }`}
                      >
                        {a.isCorrect ? "✓ " : "○ "}
                        {a.answer}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {topic._count.flashcards > 0 && (
          <p className="text-sm text-muted-foreground">
            {topic._count.flashcards} flashcard
            {topic._count.flashcards !== 1 ? "s" : ""} for this topic
          </p>
        )}
      </div>
      <div className="pt-5">
        <Button id="delete" className="float-end bg-red-500" onClick={deleteTopic}>delete</Button>
      </div>
    </>
  )
}
