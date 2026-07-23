"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Header } from "@/components/layout/header"
import { ExcelBulkImport } from "@/components/admin/excel-bulk-import"
import { ManualQuestionForm } from "@/components/admin/manual-question-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ChapterQuestion {
  id: string
  question: string
  answers: { answer: string; isCorrect: boolean }[]
}

interface ChapterDetail {
  id: string
  title: string
  module: { id: string; title: string }
  questions: ChapterQuestion[]
}

export default function AdminChapterQuizPage() {
  const params = useParams()
  const id = params.id as string
  const [chapter, setChapter] = useState<ChapterDetail | null>(null)

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

  const breadcrumb = `${chapter.module.title} / ${chapter.title}`

  return (
    <>
      <Header title={`${chapter.title} · Quiz`} subtitle={breadcrumb} />

      <Link
        href={`/admin/chapters/${chapter.id}`}
        className="mb-6 inline-block text-sm text-muted-foreground hover:text-primary"
      >
        ← Back to chapter
      </Link>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Add a question</CardTitle>
          </CardHeader>
          <CardContent>
            <ManualQuestionForm chapterId={id} onSaved={load} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bulk upload questions (Excel)</CardTitle>
          </CardHeader>
          <CardContent>
            <ExcelBulkImport
              chapterId={id}
              type="questions"
              onImported={load}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved questions ({chapter.questions.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {chapter.questions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No chapter questions yet. Add one above or upload an Excel file.
              </p>
            ) : (
              chapter.questions.map((q, i) => (
                <div
                  key={q.id}
                  className="neo-inset rounded-[var(--neo-radius)] p-4"
                >
                  <p className="mb-2 font-medium">
                    {i + 1}. {q.question}
                  </p>
                  <ul className="space-y-1">
                    {q.answers.map((a) => (
                      <li
                        key={a.answer}
                        className={`text-sm ${
                          a.isCorrect
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
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
