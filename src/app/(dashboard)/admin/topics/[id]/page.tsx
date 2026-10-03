"use client"

import { useCallback, useEffect, useState } from "react"
import { BookOpen, FileText, Layers, ListChecks } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { ContentManager } from "@/components/admin/content-manager"
import { TopicPdfManager } from "@/components/admin/topic-pdf-manager"
import { ExcelBulkImport } from "@/components/admin/excel-bulk-import"
import { FlashcardTools } from "@/components/admin/flashcard-tools"
import { LockTopicToggle } from "@/components/admin/lock-topic-toggle"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AiQuestionGenerator } from "@/components/admin/ai-question-generator"
import { DeleteQuestionButton } from "@/components/admin/delete-question-button"
import { MoveQuestionButton } from "@/components/admin/move-question-button"
import { Button } from "@/components/ui/button"
import { MathText } from "@/components/ui/math-text"

interface TopicDetail {
  id: string
  title: string
  content: string | null
  assignment: string | null
  locked?: boolean
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
  flashcards: { id: string; front: string; back: string }[]
  _count: { flashcards: number }
}

export default function AdminTopicDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [topic, setTopic] = useState<TopicDetail | null>(null)
  const [tab, setTab] = useState("lesson")

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

      <LockTopicToggle
        topicId={id}
        locked={!!topic.locked}
        onChanged={locked => setTopic(prev => (prev ? { ...prev, locked } : prev))}
      />

      {/* Tabs stay mounted (forceMount) so switching tabs never loses an unsaved lesson */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 border border-foreground shadow-none">
          <TabsTrigger value="lesson" className="gap-2 px-2">
            <BookOpen className="hidden h-4 w-4 sm:block" />
            <span>Lesson</span>
          </TabsTrigger>
          <TabsTrigger value="pdfs" className="gap-2 px-2">
            <FileText className="hidden h-4 w-4 sm:block" />
            <span>PDFs</span>
          </TabsTrigger>
          <TabsTrigger value="questions" className="gap-2 px-2">
            <ListChecks className="hidden h-4 w-4 sm:block" />
            <span>Questions</span>
            <CountBadge n={topic.questions.length} />
          </TabsTrigger>
          <TabsTrigger value="flashcards" className="gap-2 px-2">
            <Layers className="hidden h-4 w-4 sm:block" />
            <span className="truncate">Flashcards</span>
            <CountBadge n={topic._count.flashcards} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lesson" forceMount className="data-[state=inactive]:hidden">
          <ContentManager
            topicId={id}
            initialContent={topic.content ?? ""}
            initialAssignment={topic.assignment ?? ""}
            onSaved={load}
          />
        </TabsContent>

        <TabsContent value="pdfs" forceMount className="data-[state=inactive]:hidden">
          <Panel title="PDF content" description="Textbook pages and notes students read in the topic's PDF tab.">
            <TopicPdfManager topicId={id} />
          </Panel>
        </TabsContent>

        <TabsContent value="questions" forceMount className="data-[state=inactive]:hidden">
          <Panel title="Questions" description="The topic quiz picks from these. Add them with AI, from Excel, or move them here from other topics.">
            <div className="space-y-8">
              <section className="space-y-3">
                <h3 className="font-semibold">Generate with AI</h3>
                <AiQuestionGenerator topicId={id} onSaved={load} />
              </section>

              <section className="space-y-3 border-t border-border pt-6">
                <h3 className="font-semibold">Bulk upload (Excel)</h3>
                <ExcelBulkImport topicId={id} type="questions" onImported={load} />
              </section>

              <section className="space-y-4 border-t border-border pt-6">
                <h3 className="font-semibold">Saved questions ({topic.questions.length})</h3>
                {topic.questions.length === 0 && (
                  <p className="text-sm text-muted-foreground">No questions yet.</p>
                )}
                {topic.questions.map((q, i) => (
                  <div key={q.id} className="rounded-2xl border border-border p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <p className="whitespace-pre-wrap font-medium">
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
                          className={`text-sm ${a.isCorrect ? "font-medium text-green-700" : "text-muted-foreground"}`}
                        >
                          {a.isCorrect ? "✓ " : "○ "}
                          <MathText text={a.answer} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="flashcards" forceMount className="data-[state=inactive]:hidden">
          <Panel title="Flashcards" description="Students review these in the topic's Flashcards tab.">
            <FlashcardTools
              topicId={id}
              flashcards={topic.flashcards ?? []}
              hasLesson={!!topic.content?.replace(/<[^>]+>/g, "").trim()}
              onChanged={load}
            />
          </Panel>
        </TabsContent>
      </Tabs>

      <div className="mt-10 flex justify-end border-t border-border pt-6">
        <Button
          id="delete"
          variant="ghost"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={deleteTopic}
        >
          Delete topic
        </Button>
      </div>
    </>
  )
}

/** One tab's content, laid straight onto the white page */
function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
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

function CountBadge({ n }: { n: number }) {
  if (n === 0) return null
  return (
    <span className="hidden rounded-full bg-muted px-1.5 text-[11px] font-semibold leading-5 text-muted-foreground sm:inline">
      {n}
    </span>
  )
}
