"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { AlertCircle, Check, CheckCircle2, ChevronDown, Copy, Download, FileCode2, Loader2, Upload, X } from "lucide-react"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { useCourseCrumb } from "@/components/modules/use-course-crumb"
import { TopicContentView } from "@/components/topic/topic-content-view"
import { Button } from "@/components/ui/button"
import {
  CODING_LANGUAGES,
  MAX_FILE_BYTES,
  MAX_FILES,
  MAX_TOTAL_BYTES,
  PROJECT_PASS_MARK,
  UPLOAD_EXTENSIONS,
  extensionOf,
  type CodingLanguage,
  type ProjectFeedback,
  type RubricItem,
} from "@/lib/coding-shared"
import { cn } from "@/lib/utils"

interface Project {
  id: string
  title: string
  brief: string
  language: CodingLanguage
  starterCode: string | null
  rubric: RubricItem[]
  difficulty: string
}

interface Submission {
  id: string
  score: number
  feedback: ProjectFeedback
  files: { name: string; content: string }[]
  createdAt: string
}

interface TopicInfo {
  id: string
  title: string
  chapter: { id: string; title: string; module: { id: string; title: string } }
}

const STARTER_NAME: Record<CodingLanguage, string> = {
  cpp: "main.cpp", c: "main.c", python: "main.py", javascript: "main.js", typescript: "main.ts",
  java: "Main.java", csharp: "Program.cs", sql: "query.sql", php: "index.php",
}

export default function ProjectPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const courseCrumb = useCourseCrumb(params.id as string)
  const [project, setProject] = useState<Project | null>(null)
  const [topic, setTopic] = useState<TopicInfo | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loadError, setLoadError] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState("")
  const [marking, setMarking] = useState(false)
  const [latest, setLatest] = useState<Submission | null>(null)
  const [copied, setCopied] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setLoadError(res.status === 403 ? "This topic is locked. Pass the previous topic's quiz first." : data.error ?? "Couldn't load the project")
      return
    }
    setProject(data.project)
    setTopic(data.topic)
    setSubmissions(data.submissions)
  }, [projectId])

  useEffect(() => {
    queueMicrotask(load)
  }, [load])

  function addFiles(list: FileList | File[]) {
    setError("")
    const incoming = [...list]
    const bad = incoming.find(f => !UPLOAD_EXTENSIONS.includes(extensionOf(f.name)))
    if (bad) {
      setError(`${bad.name} can't be uploaded. Upload your source files (${UPLOAD_EXTENSIONS.join(", ")}).`)
      return
    }
    const big = incoming.find(f => f.size > MAX_FILE_BYTES)
    if (big) {
      setError(`${big.name} is too big (max ${MAX_FILE_BYTES / 1024} KB per file).`)
      return
    }
    setFiles(prev => {
      // Same name again replaces the earlier one
      const merged = [...prev.filter(p => !incoming.some(f => f.name === p.name)), ...incoming]
      if (merged.length > MAX_FILES) setError(`Upload at most ${MAX_FILES} files.`)
      return merged.slice(0, MAX_FILES)
    })
  }

  async function submit() {
    if (files.length === 0 || marking) return
    const total = files.reduce((n, f) => n + f.size, 0)
    if (total > MAX_TOTAL_BYTES) {
      setError(`The files are too big together (max ${MAX_TOTAL_BYTES / 1024} KB).`)
      return
    }
    setMarking(true)
    setError("")
    try {
      const form = new FormData()
      files.forEach(f => form.append("files", f, f.name))
      const res = await fetch(`/api/projects/${projectId}/submit`, { method: "POST", body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Couldn't mark your project. Try again.")
      const sub = data.submission as Submission
      setLatest(sub)
      setSubmissions(prev => [sub, ...prev])
      setFiles([])
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't mark your project. Try again.")
    } finally {
      setMarking(false)
    }
  }

  function downloadStarter() {
    if (!project?.starterCode) return
    const url = URL.createObjectURL(new Blob([project.starterCode], { type: "text/plain" }))
    const a = document.createElement("a")
    a.href = url
    a.download = STARTER_NAME[project.language] ?? "main.txt"
    a.click()
    URL.revokeObjectURL(url)
  }

  async function copyStarter() {
    if (!project?.starterCode) return
    await navigator.clipboard.writeText(project.starterCode).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <p className="text-muted-foreground">{loadError}</p>
        <Link href={`/modules/${params.id}/topics/${params.topicId}`} className="mt-4 inline-block font-medium text-primary hover:underline">
          ← Back to the topic
        </Link>
      </div>
    )
  }
  if (!project || !topic) return <p className="px-4 text-sm text-muted-foreground">Loading…</p>

  const best = submissions.length ? Math.max(...submissions.map(s => s.score)) : null
  const language = CODING_LANGUAGES[project.language]?.label ?? project.language
  const accept = UPLOAD_EXTENSIONS.join(",")

  return (
    <div data-page-bg="white" className="mx-auto max-w-4xl px-4 pb-28">
      <Breadcrumbs
        items={[
          ...courseCrumb,
          { label: topic.chapter.module.title, href: `/modules/${topic.chapter.module.id}` },
          { label: topic.title, href: `/modules/${topic.chapter.module.id}/topics/${topic.id}` },
          { label: project.title },
        ]}
      />

      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Coding project · {language} · {project.difficulty}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{project.title}</h1>
        {best !== null && (
          <p className="mt-2 text-sm">
            Your best mark:{" "}
            <span className={cn("font-semibold", best >= PROJECT_PASS_MARK ? "text-green-700" : "text-orange-700")}>{best}%</span>
            <span className="text-muted-foreground">
              {" "}· {submissions.length} {submissions.length === 1 ? "submission" : "submissions"}
            </span>
          </p>
        )}
      </header>

      <TopicContentView content={project.brief} />

      {project.starterCode && (
        <section className="mt-8">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Starter code</h2>
            <div className="flex gap-2">
              <Button size="sm" onClick={copyStarter}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" onClick={downloadStarter}>
                <Download className="h-4 w-4" />
                {STARTER_NAME[project.language]}
              </Button>
            </div>
          </div>
          <pre className="max-h-96 overflow-auto rounded-2xl bg-neutral-900 p-4 text-sm leading-relaxed text-neutral-100">
            <code>{project.starterCode}</code>
          </pre>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-2 text-lg font-semibold">How it&apos;s marked</h2>
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {project.rubric.map(r => (
            <li key={r.criterion} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
              <span>{r.criterion}</span>
              <span className="shrink-0 font-semibold">{r.points}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="mb-1 text-lg font-semibold">Submit your code</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Upload your source files (up to {MAX_FILES}). The AI reads your code, traces it against the brief and marks it with the
          rubric. It takes up to a minute.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={e => {
            if (e.target.files) addFiles(e.target.files)
            e.target.value = ""
          }}
        />
        <div
          onDragOver={e => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault()
            setDragging(false)
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
          }}
          className={cn(
            "flex flex-col items-center gap-3 rounded-[1.5rem] border-2 border-dashed px-4 py-8 text-center transition-colors",
            dragging ? "border-foreground bg-muted/50" : "border-border"
          )}
        >
          <FileCode2 className="h-9 w-9 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Drop your files here, or</p>
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={marking}>
            <Upload className="h-4 w-4" />
            Choose files
          </Button>
        </div>

        {files.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {files.map(f => (
              <li key={f.name} className="flex items-center gap-3 rounded-2xl border border-border px-4 py-2 text-sm">
                <FileCode2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-mono">{f.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</span>
                <button
                  type="button"
                  onClick={() => setFiles(prev => prev.filter(p => p.name !== f.name))}
                  disabled={marking}
                  className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="mt-3 flex items-start gap-2 text-sm text-red-600" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <Button variant="primary" size="lg" className="mt-4 w-full sm:w-auto" onClick={submit} disabled={files.length === 0 || marking}>
          {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {marking ? "Marking your code…" : `Submit ${files.length || ""} file${files.length === 1 ? "" : "s"} for marking`}
        </Button>
      </section>

      {latest && (
        <section ref={resultRef} className="mt-10 scroll-mt-28">
          <h2 className="mb-3 text-lg font-semibold">Your mark</h2>
          <FeedbackCard submission={latest} />
        </section>
      )}

      {submissions.filter(s => s.id !== latest?.id).length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Earlier submissions</h2>
          <ul className="space-y-2">
            {submissions
              .filter(s => s.id !== latest?.id)
              .map(s => (
                <li key={s.id}>
                  <details className="group rounded-2xl border border-border">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm">
                      <span className={cn("font-semibold", s.score >= PROJECT_PASS_MARK ? "text-green-700" : "text-orange-700")}>{s.score}%</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {new Date(s.createdAt).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                        {s.files.map(f => f.name).join(", ")}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="border-t border-border p-4">
                      <FeedbackCard submission={s} />
                    </div>
                  </details>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function FeedbackCard({ submission }: { submission: Submission }) {
  const { score, feedback, files } = submission
  const passed = score >= PROJECT_PASS_MARK
  return (
    <div className="space-y-5">
      <div className={cn("flex items-center gap-4 rounded-[1.5rem] px-5 py-4", passed ? "bg-green-50" : "bg-orange-50")}>
        <span className={cn("text-4xl font-bold tabular-nums", passed ? "text-green-700" : "text-orange-700")}>{score}%</span>
        <p className="text-sm">{feedback.summary}</p>
      </div>

      <ul className="divide-y divide-border rounded-2xl border border-border">
        {feedback.rubric.map(r => (
          <li key={r.criterion} className="px-4 py-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="font-medium">{r.criterion}</span>
              <span className="shrink-0 font-semibold tabular-nums">
                {r.points}/{r.max}
              </span>
            </div>
            {r.comment && <p className="mt-1 text-muted-foreground">{r.comment}</p>}
          </li>
        ))}
      </ul>

      {feedback.strengths.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold">What you did well</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {feedback.strengths.map(s => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {feedback.improvements.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold">What to improve</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {feedback.improvements.map(s => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Code you submitted ({files.length} file{files.length === 1 ? "" : "s"})</summary>
        <div className="mt-2 space-y-3">
          {files.map(f => (
            <div key={f.name}>
              <p className="mb-1 font-mono text-xs text-muted-foreground">{f.name}</p>
              <pre className="max-h-80 overflow-auto rounded-xl bg-neutral-900 p-3 text-xs text-neutral-100">
                <code>{f.content}</code>
              </pre>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
