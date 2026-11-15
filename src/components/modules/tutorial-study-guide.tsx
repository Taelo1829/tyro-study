"use client"
import { useEffect, useState } from "react"
import type { TutorialGuide } from "@/lib/tutorial-letter-types"
import { WeeklyStudyPlanner } from "./weekly-study-planner"

export function TutorialGuideContent({ guide }: { guide: TutorialGuide }) {
  return <div className="space-y-4 text-sm">
    <div><h3 className="font-semibold">Prescribed book</h3><p>{guide.book}</p><p className="mt-1 text-xs text-muted-foreground">Source: {guide.sourceName} · {guide.year}</p>{guide.contentsSource.startsWith("https://") && <a className="mt-1 inline-block underline" href={guide.contentsSource} target="_blank" rel="noopener noreferrer">View published book contents</a>}</div>
    {guide.warnings.map(w => <p key={w} className="rounded-lg bg-muted p-3 text-muted-foreground">{w}</p>)}
    {guide.notes.length > 0 && <div><h3 className="mb-2 font-semibold">How to study</h3><ul className="list-disc space-y-2 pl-5">{guide.notes.map((n, i) => <li key={i}>{n.text}</li>)}</ul></div>}
    {guide.studyPlan.length > 0 && <div><h3 className="mb-2 font-semibold">Study schedule from the letter</h3><ol className="space-y-2">{guide.studyPlan.map((s, i) => <li key={i} className="rounded-lg border p-3"><strong>{s.period}</strong><p className="mt-1">{s.reading}</p></li>)}</ol></div>}
    {guide.assessments.length > 0 && <div><h3 className="mb-2 font-semibold">Assessment guide</h3><div className="space-y-2">{guide.assessments.map((a, i) => <details key={i} className="rounded-lg border p-3"><summary className="cursor-pointer font-medium">{a.title} · {a.selfTest ? "Self-test — do not submit" : `Weight: ${a.weight}`}</summary><p className="mt-2 whitespace-pre-line">{a.instructions}</p><p className="mt-2 text-muted-foreground">Read book chapters/appendices {a.chapterRefs.join(", ")} first. Format: {a.format === "mcq" ? "Multiple choice" : a.format}.</p></details>)}</div></div>}
  </div>
}
export function TutorialStudyGuide({ moduleId }: { moduleId: string }) {
  const [guide, setGuide] = useState<TutorialGuide | null>(null)
  useEffect(() => {
    let active = true
    fetch(`/api/modules/${moduleId}/study-guide`).then(r => r.ok ? r.json() : null).then(g => { if (active) setGuide(g) }).catch(() => {})
    return () => { active = false }
  }, [moduleId])
  if (!guide) return null
  return <><WeeklyStudyPlanner key={moduleId} moduleId={moduleId} guide={guide} /><details className="mb-6 rounded-xl border bg-card p-5"><summary className="cursor-pointer text-lg font-semibold">Your study guide <span className="text-sm font-normal text-muted-foreground">· Book, study schedule and assessments</span></summary><div className="mt-4"><TutorialGuideContent guide={guide} /></div></details></>
}
