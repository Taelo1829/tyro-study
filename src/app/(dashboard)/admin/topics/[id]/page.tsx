"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { ContentManager } from "@/components/admin/content-manager"
import { TopicPdfManager } from "@/components/admin/topic-pdf-manager"
import { ExcelBulkImport } from "@/components/admin/excel-bulk-import"
import { AiQuestionGenerator } from "@/components/admin/ai-question-generator"
import { DeleteQuestionButton } from "@/components/admin/delete-question-button"
import { MoveQuestionButton } from "@/components/admin/move-question-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MathText } from "@/components/ui/math-text"

interface TopicDetail {
  id: string
  title: string
  content: string | null
  assignment: string | null
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
      return
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

  return (
    <>
      <Breadcrumbs
        items={[
          { label: topic.chapter.module.title, href: `/admin/modules/${topic.chapter.module.id}` },
          { label: topic.chapter.title, href: `/admin/chapters/${topic.chapter.id}` },
          { label: topic.title },
        ]}
      />

      <div className="space-y-6">
        <ContentManager
          topicId={id}
          initialContent={topic.content ?? ""}
          initialAssignment={topic.assignment ?? ""}
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
            <CardTitle>Generate questions with AI</CardTitle>
          </CardHeader>
          <CardContent>
            <AiQuestionGenerator topicId={id} onSaved={load} />
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
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className="font-medium">
                      {i + 1}. <MathText text={q.question} />
                    </p>
                    <div className="flex shrink-0 items-center">
                      <MoveQuestionButton questionId={q.id} questionText={q.question} currentTopicId={id} onMoved={load} />
                      <DeleteQuestionButton questionId={q.id} onDeleted={load} />
                    </div>
                  </div>
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
                        <MathText text={a.answer} />
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
