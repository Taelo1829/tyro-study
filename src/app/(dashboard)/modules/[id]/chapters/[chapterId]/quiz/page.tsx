"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Answer = { id: string; answer: string; isCorrect: boolean }
type Question = { id: string; question: string; answers: Answer[] }
type Chapter = {
  title: string
  questions: Question[]
  topics: { title: string; questions: Question[] }[]
}

export default function ChapterQuizPage() {
  const { chapterId, id: moduleId } = useParams<{ chapterId: string; id: string }>()
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  useEffect(() => { fetch(`/api/chapters/${chapterId}`).then(async r => { if (r.ok) setChapter(await r.json()) }) }, [chapterId])
  const questions = useMemo(() => {
    if (!chapter) return []
    const direct = chapter.questions.map(question => ({ ...question, topic: chapter.title }))
    const fromTopics = chapter.topics.flatMap(topic => topic.questions.map(question => ({ ...question, topic: topic.title })))
    return [...direct, ...fromTopics]
  }, [chapter])
  if (!chapter) return <p className="text-sm text-muted-foreground">Loading chapter quiz…</p>
  if (!questions.length) return <p className="text-sm text-muted-foreground">No questions have been added to this chapter.</p>
  const current = questions[index]
  const score = questions.filter(q => q.answers.some(a => a.id === selected[q.id] && a.isCorrect)).length
  if (submitted) return <Card className="mx-auto max-w-2xl"><CardHeader><CardTitle>Chapter quiz results</CardTitle><CardDescription>{chapter.title}</CardDescription></CardHeader><CardContent className="space-y-4"><p className="text-4xl font-bold">{Math.round(score / questions.length * 100)}%</p><p>{score} of {questions.length} correct.</p><div className="flex gap-3"><Button onClick={() => { setSelected({}); setIndex(0); setSubmitted(false) }}>Try again</Button><Link href={`/modules/${moduleId}/chapters/${chapterId}`}><Button variant="outline">Back to chapter</Button></Link></div></CardContent></Card>
  return <div className="mx-auto max-w-3xl space-y-5"><Link href={`/modules/${moduleId}/chapters/${chapterId}`} className="text-sm text-muted-foreground hover:text-primary">← Back to chapter</Link><Card><CardHeader><CardDescription>{current.topic} · Question {index + 1} of {questions.length}</CardDescription><CardTitle>{current.question}</CardTitle></CardHeader><CardContent className="space-y-3">{current.answers.map(answer => <button key={answer.id} onClick={() => setSelected(values => ({ ...values, [current.id]: answer.id }))} className={`block w-full rounded-lg border p-4 text-left ${selected[current.id] === answer.id ? "border-primary bg-primary/10" : "hover:bg-muted"}`}>{answer.answer}</button>)}<div className="flex justify-between pt-4"><Button variant="outline" disabled={!index} onClick={() => setIndex(index - 1)}>Previous</Button>{index === questions.length - 1 ? <Button disabled={Object.keys(selected).length !== questions.length} onClick={() => setSubmitted(true)}>Submit quiz</Button> : <Button disabled={!selected[current.id]} onClick={() => setIndex(index + 1)}>Next</Button>}</div></CardContent></Card></div>
}
