"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ChevronDown, ExternalLink, Loader2, Plus, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TopicContentView } from "@/components/topic/topic-content-view"
import { CODING_LANGUAGES, type CodingLanguage, type RubricItem } from "@/lib/coding-shared"

/**
 * Admin: a topic's coding projects. Generate them with AI, write one by
 * hand, look through them, delete. Only coding modules get projects.
 */

interface ProjectSummary {
  id: string
  title: string
  difficulty: string
  language: CodingLanguage
}

interface ProjectDetail extends ProjectSummary {
  brief: string
  starterCode: string | null
  rubric: RubricItem[]
}

const LEVEL_STYLE: Record<string, string> = {
  easy: "bg-green-100 text-green-800",
  medium: "bg-sky-100 text-sky-800",
  hard: "bg-orange-100 text-orange-800",
}

export function ProjectManager({ topicId, moduleId, onCount }: { topicId: string; moduleId: string; onCount?: (n: number) => void }) {
  const [coding, setCoding] = useState<{ language: CodingLanguage | null } | null>(null)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [open, setOpen] = useState<Record<string, ProjectDetail | "loading">>({})
  const [count, setCount] = useState(2)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [writing, setWriting] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/topics/${topicId}/projects`)
    if (!res.ok) return
    const data = (await res.json()) as { coding: { language: CodingLanguage | null }; projects: ProjectSummary[] }
    setCoding(data.coding)
    setProjects(data.projects)
    onCount?.(data.projects.length)
  }, [topicId, onCount])

  useEffect(() => {
    queueMicrotask(load)
  }, [load])

  async function generate() {
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const res = await fetch(`/api/topics/${topicId}/projects/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Couldn't write the projects")
      setMessage(data.added ? `Added ${data.added} project${data.added === 1 ? "" : "s"}.` : "The AI didn't come up with new projects. Try again.")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't write the projects")
    } finally {
      setBusy(false)
    }
  }

  async function toggle(id: string) {
    if (open[id]) {
      setOpen(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      return
    }
    setOpen(prev => ({ ...prev, [id]: "loading" }))
    const res = await fetch(`/api/projects/${id}`)
    const data = res.ok ? ((await res.json()) as { project: ProjectDetail }) : null
    setOpen(prev => ({ ...prev, ...(data ? { [id]: data.project } : {}) }))
  }

  async function remove(p: ProjectSummary) {
    if (!confirm(`Delete the project "${p.title}"? Students' submissions for it are deleted too.`)) return
    const res = await fetch(`/api/projects/${p.id}`, { method: "DELETE" })
    if (res.ok) await load()
  }

  if (!coding) return <p className="text-sm text-muted-foreground">Loading…</p>

  const language = coding.language ? CODING_LANGUAGES[coding.language].label : null

  return (
    <div className="space-y-8">
      {!language ? (
        <p className="rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
          This module isn&apos;t a coding module, so its topics don&apos;t get coding projects. To change that, open the module and use
          Edit module › Coding module.
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <h3 className="font-semibold">Generate with AI</h3>
            <p className="text-sm text-muted-foreground">
              The AI writes {language} projects that practise this topic: a brief with an example run, starter code and a marking
              rubric. Students upload their code and the AI marks it against the rubric.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                Projects
                <select
                  value={count}
                  onChange={e => setCount(Number(e.target.value))}
                  disabled={busy}
                  className="rounded-full border border-border bg-white px-3 py-1.5 text-sm"
                >
                  {[1, 2, 3, 4, 5].map(n => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="primary" onClick={generate} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {busy ? "Writing…" : "Generate projects"}
              </Button>
            </div>
            {message && <p className="text-sm text-green-700">{message}</p>}
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <button type="button" onClick={() => setWriting(w => !w)} className="flex items-center gap-2 font-semibold">
              <Plus className="h-4 w-4" />
              Write a project yourself
              <ChevronDown className={`h-4 w-4 transition-transform ${writing ? "rotate-180" : ""}`} />
            </button>
            {writing && (
              <ManualProjectForm
                topicId={topicId}
                onSaved={async () => {
                  setWriting(false)
                  await load()
                }}
              />
            )}
          </section>
        </>
      )}

      <section className="space-y-3 border-t border-border pt-6">
        <h3 className="font-semibold">Projects ({projects.length})</h3>
        {projects.length === 0 && <p className="text-sm text-muted-foreground">No projects yet.</p>}
        {projects.map((p, i) => {
          const detail = open[p.id]
          return (
            <div key={p.id} className="rounded-2xl border border-border">
              <div className="flex items-center gap-3 p-4">
                <button type="button" onClick={() => toggle(p.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${detail ? "rotate-180" : ""}`} />
                  <span className="font-medium">
                    {i + 1}. {p.title}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_STYLE[p.difficulty] ?? LEVEL_STYLE.medium}`}>
                    {p.difficulty}
                  </span>
                </button>
                <Link
                  href={`/modules/${moduleId}/topics/${topicId}/projects/${p.id}`}
                  className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Open as a student sees it"
                  title="Open as a student sees it"
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => remove(p)}
                  className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                  aria-label={`Delete ${p.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {detail === "loading" && <p className="px-4 pb-4 text-sm text-muted-foreground">Loading…</p>}
              {detail && detail !== "loading" && (
                <div className="space-y-4 border-t border-border p-4">
                  <TopicContentView content={detail.brief} />
                  {detail.starterCode && (
                    <div>
                      <p className="mb-1 text-sm font-semibold">Starter code</p>
                      <pre className="max-h-72 overflow-auto rounded-xl bg-muted p-3 text-xs">{detail.starterCode}</pre>
                    </div>
                  )}
                  <div>
                    <p className="mb-1 text-sm font-semibold">Rubric</p>
                    <ul className="space-y-1 text-sm">
                      {detail.rubric.map(r => (
                        <li key={r.criterion} className="flex justify-between gap-3">
                          <span>{r.criterion}</span>
                          <span className="shrink-0 font-medium">{r.points}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}

function ManualProjectForm({ topicId, onSaved }: { topicId: string; onSaved: () => void }) {
  const [title, setTitle] = useState("")
  const [brief, setBrief] = useState("")
  const [starter, setStarter] = useState("")
  const [rubric, setRubric] = useState("Correct output for the example: 40\nHandles edge cases and invalid input: 20\nUses the technique from this topic: 25\nCode quality (names, comments, structure): 15")
  const [difficulty, setDifficulty] = useState("medium")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      // "Criterion: points" per line
      const items = rubric
        .split("\n")
        .map(line => line.match(/^(.+?)\s*[:\-–]\s*(\d+)\s*$/))
        .filter((m): m is RegExpMatchArray => !!m)
        .map(m => ({ criterion: m[1].trim(), points: Number(m[2]) }))
      const res = await fetch(`/api/topics/${topicId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, brief, starterCode: starter, rubric: items, difficulty }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the project")
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the project")
      setSaving(false)
    }
  }

  const area = "neo-inset w-full resize-y rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/50"
  return (
    <form onSubmit={save} className="space-y-3">
      <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title, e.g. Spaza shop stock report" aria-label="Project title" />
      <textarea
        value={brief}
        onChange={e => setBrief(e.target.value)}
        rows={6}
        placeholder="The brief: what the program must do, the input and output, requirements, and an example run."
        aria-label="Project brief"
        className={area}
      />
      <textarea
        value={starter}
        onChange={e => setStarter(e.target.value)}
        rows={4}
        placeholder="Starter code (optional)"
        aria-label="Starter code"
        className={`${area} font-mono`}
      />
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="rubric">
          Rubric: one &ldquo;criterion: points&rdquo; per line (scaled to 100)
        </label>
        <textarea id="rubric" value={rubric} onChange={e => setRubric(e.target.value)} rows={4} className={area} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="rounded-full border border-border bg-white px-3 py-1.5 text-sm" aria-label="Difficulty">
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <Button type="submit" variant="primary" disabled={saving || !title.trim() || !brief.trim()}>
          {saving ? "Saving…" : "Save project"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </form>
  )
}
