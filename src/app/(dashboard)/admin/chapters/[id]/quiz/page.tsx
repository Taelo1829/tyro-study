"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { FileSpreadsheet, ListChecks, PenLine, Sparkles } from "lucide-react"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { ExcelBulkImport } from "@/components/admin/excel-bulk-import"
import { AiQuestionGenerator } from "@/components/admin/ai-question-generator"
import { DeleteQuestionButton } from "@/components/admin/delete-question-button"
import { MoveQuestionButton } from "@/components/admin/move-question-button"
import { ManualQuestionForm } from "@/components/admin/manual-question-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MathText } from "@/components/ui/math-text"

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
  const [tab, setTab] = useState("questions")

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

  // After adding questions, jump back to the list so you can see them
  const added = () => {
    void load()
    setTab("questions")
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: chapter.module.title, href: `/admin/modules/${chapter.module.id}` },
          { label: chapter.title, href: `/admin/chapters/${chapter.id}` },
          { label: "Chapter quiz" },
        ]}
      />

      {/* Tabs stay mounted so a half-written question isn't lost when switching */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 border border-foreground shadow-none">
          <TabsTrigger value="questions" className="gap-2 px-2">
            <ListChecks className="hidden h-4 w-4 sm:block" />
            <span>Questions</span>
            {chapter.questions.length > 0 && (
              <span className="hidden rounded-full bg-muted px-1.5 text-[11px] font-semibold leading-5 text-muted-foreground sm:inline">
                {chapter.questions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2 px-2">
            <Sparkles className="hidden h-4 w-4 sm:block" />
            <span>AI</span>
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2 px-2">
            <PenLine className="hidden h-4 w-4 sm:block" />
            <span>Add</span>
          </TabsTrigger>
          <TabsTrigger value="excel" className="gap-2 px-2">
            <FileSpreadsheet className="hidden h-4 w-4 sm:block" />
            <span>Excel</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="questions" forceMount className="data-[state=inactive]:hidden">
          <Section
            title={`Chapter questions (${chapter.questions.length})`}
            description="The chapter quiz uses these together with all the topic questions in this chapter."
          >
            {chapter.questions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No chapter questions yet. Use the AI, Add or Excel tabs to add some.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {chapter.questions.map((q, i) => (
                  <li key={q.id} className="py-4 first:pt-0">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <p className="whitespace-pre-wrap font-medium">
                        {i + 1}. <MathText text={q.question} />
                      </p>
                      <div className="flex shrink-0 items-center">
                        <MoveQuestionButton questionId={q.id} questionText={q.question} currentChapterId={id} onMoved={load} />
                        <DeleteQuestionButton questionId={q.id} onDeleted={load} />
                      </div>
                    </div>
                    <ul className="space-y-1">
                      {q.answers.map((a) => (
                        <li
                          key={a.answer}
                          className={`text-sm ${a.isCorrect ? "font-medium text-green-700" : "text-muted-foreground"}`}
                        >
                          {a.isCorrect ? "✓ " : "○ "}
                          <MathText text={a.answer} />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="ai" forceMount className="data-[state=inactive]:hidden">
          <Section title="Generate questions with AI">
            <AiQuestionGenerator chapterId={id} onSaved={added} />
          </Section>
        </TabsContent>

        <TabsContent value="manual" forceMount className="data-[state=inactive]:hidden">
          <Section title="Add a question">
            <ManualQuestionForm chapterId={id} onSaved={added} />
          </Section>
        </TabsContent>

        <TabsContent value="excel" forceMount className="data-[state=inactive]:hidden">
          <Section title="Bulk upload questions (Excel)">
            <ExcelBulkImport chapterId={id} type="questions" onImported={added} />
          </Section>
        </TabsContent>
      </Tabs>
    </>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="px-1 py-2">
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}
