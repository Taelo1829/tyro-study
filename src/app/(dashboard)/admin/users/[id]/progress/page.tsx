"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Header } from "@/components/layout/header"
import { ProgressReport, type ModuleProgressData } from "@/components/progress/progress-report"

interface StudentInfo {
  id: string
  name: string | null
  email: string
  modules: { id: string; title: string }[]
}

/** Admin: one student's quiz tracking, module by module */
export default function StudentProgressPage() {
  const { id } = useParams<{ id: string }>()
  const [student, setStudent] = useState<StudentInfo | null>(null)
  const [moduleId, setModuleId] = useState<string | null>(null)
  const [data, setData] = useState<ModuleProgressData | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let live = true
    fetch(`/api/progress/user/${id}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("Couldn't load this student"))))
      .then((s: StudentInfo) => {
        if (!live) return
        setStudent(s)
        setModuleId(s.modules[0]?.id ?? null)
      })
      .catch(e => live && setError(e.message))
    return () => {
      live = false
    }
  }, [id])

  useEffect(() => {
    if (!moduleId) return
    let live = true
    fetch(`/api/progress/module/${moduleId}?userId=${encodeURIComponent(id)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => live && setData(d))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [id, moduleId])

  return (
    <>
      <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-primary">
        ← Users
      </Link>
      <Header title={student ? `${student.name ?? student.email}'s progress` : "Student progress"} subtitle={student?.email} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {student && student.modules.length === 0 && <p className="text-sm text-muted-foreground">This student hasn&apos;t joined any modules.</p>}
      {student && student.modules.length > 1 && (
        <div role="tablist" aria-label="Module" className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {student.modules.map(m => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={m.id === moduleId}
              onClick={() => {
                setData(null)
                setModuleId(m.id)
              }}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${m.id === moduleId ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}
            >
              {m.title}
            </button>
          ))}
        </div>
      )}
      {moduleId && !data && <p className="text-sm text-muted-foreground">Loading…</p>}
      {data && <ProgressReport data={data} moduleHref={`/modules/${data.moduleId}`} readOnly />}
    </>
  )
}
