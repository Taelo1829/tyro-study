"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight, BookOpen, CalendarDays, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DAILY_GOALS, type OnboardingInput } from "@/lib/onboarding-input"

type Deadline = { moduleId: string; type: "EXAM" | "ASSIGNMENT"; date: string }
type Module = { id: string; title: string; description: string | null }

export function OnboardingForm({ initialStep, modules, moduleLabel, modulesLabel, initialSelected, initialDeadline, today }: {
  initialStep: number; modules: Module[]; moduleLabel: string; modulesLabel: string
  initialSelected: string[]; initialDeadline: Deadline | null; today: string
}) {
  const [step, setStep] = useState(initialStep)
  const [selected, setSelected] = useState(initialSelected.filter(id => modules.some(m => m.id === id)))
  const [search, setSearch] = useState("")
  const [deadline, setDeadline] = useState<Deadline>(initialDeadline ?? { moduleId: initialSelected[0] ?? "", type: "EXAM", date: "" })
  const [goal, setGoal] = useState(10)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const heading = useRef<HTMLHeadingElement>(null)
  const labels = [`Pick ${modulesLabel}`, "Set a date", "Daily goal"]
  const icons = [BookOpen, CalendarDays, Target]
  const Icon = icons[step]
  const chosen = modules.filter(m => selected.includes(m.id))
  const visible = modules.filter(m => `${m.title} ${m.description ?? ""}`.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => { heading.current?.focus() }, [step])

  async function save(input: OnboardingInput) {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Couldn't save this step.")
      if (data.step === 3) { window.location.assign("/dashboard"); return }
      if (input.step === 0) setDeadline(d => ({ ...d, moduleId: selected.includes(d.moduleId) ? d.moduleId : selected[0] ?? "" }))
      setStep(data.step)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this step. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ol aria-label="Setup progress" className="mb-8 grid grid-cols-3 gap-3">
        {labels.map((label, i) => (
          <li key={label} aria-current={step === i ? "step" : undefined} className={i <= step ? "text-foreground" : "text-muted-foreground"}>
            <div className={`mb-2 h-1.5 rounded-full ${i <= step ? "bg-black" : "bg-muted"}`} />
            <span className="text-xs sm:text-sm">{i + 1}. {label}</span>
          </li>
        ))}
      </ol>
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white"><Icon className="h-6 w-6" aria-hidden="true" /></div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Step {step + 1} of 3</p>
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none sm:text-3xl">
          {step === 0 ? `What ${modulesLabel} are you studying?` : step === 1 ? "What are you working towards?" : "Make a little progress every day"}
        </h1>
        <p className="mb-6 mt-3 text-sm text-muted-foreground">
          {step === 0 ? `Choose your ${modulesLabel} to personalise your dashboard.` : step === 1 ? "Add your next exam or assignment. It will appear in your timetable." : "Choose how many quiz questions you want to answer each day. Start small and build a habit."}
        </p>
        <form onSubmit={e => {
          e.preventDefault()
          void save(step === 0 ? { step: 0, moduleIds: selected } : step === 1 ? { step: 1, deadline } : { step: 2, dailyGoal: goal })
        }}>
          <fieldset disabled={busy} className="space-y-4">
            <legend className="sr-only">{labels[step]}</legend>
            {step === 0 && (
              <>
                {modules.length ? (
                  <>
                    <label className="block text-sm font-medium" htmlFor="module-search">Search {modulesLabel}</label>
                    <Input id="module-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search by name or code`} />
                    <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl p-1">
                      {visible.map(m => (
                        <label key={m.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${selected.includes(m.id) ? "border-foreground bg-muted" : "border-border"}`}>
                          <input type="checkbox" checked={selected.includes(m.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, m.id] : ids.filter(id => id !== m.id))} className="mt-1 h-4 w-4 accent-black" />
                          <span className="min-w-0"><span className="block font-medium">{m.title}</span>{m.description && <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{m.description}</span>}</span>
                        </label>
                      ))}
                      {!visible.length && <p className="p-4 text-sm text-muted-foreground">No matches. Try another name or code.</p>}
                    </div>
                    <p className="text-sm text-muted-foreground" aria-live="polite">{selected.length} selected · You can change these later.</p>
                  </>
                ) : <p className="rounded-2xl bg-muted p-4 text-sm">No {modulesLabel} are available for your study level yet. You can add them from your dashboard when they’re ready.</p>}
              </>
            )}
            {step === 1 && (chosen.length ? (
              <>
                <label className="block text-sm font-medium" htmlFor="deadline-module">Choose a {moduleLabel}</label>
                <select id="deadline-module" required value={deadline.moduleId} onChange={e => setDeadline(d => ({ ...d, moduleId: e.target.value }))} className="h-12 w-full rounded-2xl border border-border bg-card px-4">
                  {chosen.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  {(["EXAM", "ASSIGNMENT"] as const).map(type => <label key={type} className={`flex cursor-pointer items-center gap-2 rounded-2xl border p-4 ${deadline.type === type ? "border-foreground bg-muted" : "border-border"}`}><input type="radio" name="deadline-type" value={type} checked={deadline.type === type} onChange={() => setDeadline(d => ({ ...d, type }))} className="accent-black" />{type === "EXAM" ? "Exam" : "Assignment"}</label>)}
                </div>
                <label className="block text-sm font-medium" htmlFor="deadline-date">{deadline.type === "EXAM" ? "Exam date" : "Due date"}</label>
                <Input id="deadline-date" type="date" required min={today} value={deadline.date} onChange={e => setDeadline(d => ({ ...d, date: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Saved as an all-day event in South African time. Add more dates or a specific time in your timetable.</p>
              </>
            ) : <p className="rounded-2xl bg-muted p-4 text-sm">Once you have {modulesLabel}, you can add dates in your timetable.</p>)}
            {step === 2 && DAILY_GOALS.map(n => (
              <label key={n} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 ${goal === n ? "border-foreground bg-muted" : "border-border"}`}>
                <input type="radio" name="daily-goal" value={n} checked={goal === n} onChange={() => setGoal(n)} className="h-4 w-4 accent-black" />
                <span><span className="block font-semibold">{n} questions a day</span><span className="text-sm text-muted-foreground">{n === 5 ? "A gentle start" : n === 10 ? "A steady routine" : "An extra challenge"}</span></span>
              </label>
            ))}
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex items-center gap-3 pt-4">
              {step > 0 && <Button type="button" onClick={() => { setError(""); setStep(s => s - 1) }}>Back</Button>}
              {!(step === 1 && !chosen.length) && <Button type="submit" variant="primary" className="ml-auto min-h-12 flex-1" disabled={step === 0 && modules.length > 0 && selected.length === 0}>
                {busy ? "Saving…" : step === 2 ? "Start studying" : "Continue"}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>}
            </div>
            {step === 1 && <button type="button" onClick={() => void save({ step: 1, deadline: null })} className="min-h-11 w-full text-sm font-medium underline underline-offset-4">{busy ? "Saving…" : "I’ll add a date later"}</button>}
          </fieldset>
        </form>
      </div>
    </>
  )
}
