"use client"

import { toPlainText } from "@/lib/plain-text"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight, Plus } from "lucide-react"
import { Header } from "@/components/layout/header"
import { EntityForm } from "@/components/admin/entity-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ModuleBuilder } from "@/components/admin/module-builder"
import { LevelPicker } from "@/components/auth/level-picker"
import type { StudyLevel } from "@/lib/levels"

interface ModuleRow {
  id: string
  title: string
  description: string | null
  _count: { chapters: number }
  courseIds?: string[]
  level?: StudyLevel
}

type LevelFilter = "all" | StudyLevel

export default function AdminModulesPage() {
  const [modules, setModules] = useState<ModuleRow[]>([])
  const [courseTitles, setCourseTitles] = useState<Map<string, string>>(new Map())
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<LevelFilter>("all")
  const [newLevel, setNewLevel] = useState<StudyLevel>("tertiary")

  const load = useCallback(async () => {
    const [res, courses] = await Promise.all([fetch("/api/modules"), fetch("/api/courses")])
    const data = await res.json()
    setModules(data)
    if (courses.ok) {
      const list = (await courses.json()) as { id: string; title: string }[]
      setCourseTitles(new Map(list.map(c => [c.id, c.title])))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    queueMicrotask(load)
  }, [load])

  return (
    <>
      <Header
        title="Modules and subjects"
        subtitle="University modules belong to courses; high school subjects belong to Grade 11 or 12. Both hold chapters."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <Link href="/admin" className="text-muted-foreground hover:text-primary">
            ← Admin
          </Link>
          <Link href="/admin/courses" className="font-medium text-primary hover:underline">
            Courses
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ModuleBuilder onAdded={load} />
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" />
            New (empty)
          </Button>
        </div>
      </div>

      <div role="tablist" aria-label="Level" className="mb-4 flex flex-wrap gap-2">
        {([
          ["all", "All"],
          ["tertiary", "University modules"],
          ["highschool", "High school subjects"],
        ] as [LevelFilter, string][]).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${filter === id ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}
          >
            {label} ({id === "all" ? modules.length : modules.filter(m => (m.level ?? "tertiary") === id).length})
          </button>
        ))}
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create an empty {newLevel === "highschool" ? "subject" : "module"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <LevelPicker value={newLevel} onChange={setNewLevel} name="new-level" />
              {newLevel === "highschool" && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  End the title with the grade, e.g. &ldquo;Physical Sciences - Grade 12&rdquo;. The AI uses it to follow that grade&apos;s CAPS content.
                </p>
              )}
            </div>
            <EntityForm
              fields={[
                { name: "title", label: "Title", required: true },
                {
                  name: "description",
                  label: "Description",
                  type: "textarea",
                  placeholder: "e.g. COS1511 Introduction to Programming I: first-year C++",
                },
              ]}
              submitLabel="Create module"
              onCancel={() => setShowForm(false)}
              onSubmit={async (values) => {
                const res = await fetch("/api/modules", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ...values, level: newLevel }),
                })
                if (!res.ok) {
                  const data = await res.json()
                  throw new Error(data.error ?? "Failed to create")
                }
                // Show the new module straight away, then sync in the background
                const created = (await res.json()) as Omit<ModuleRow, "_count">
                setModules(prev =>
                  prev.some(m => m.id === created.id)
                    ? prev
                    : [...prev, { ...created, _count: { chapters: 0 } }]
                )
                setShowForm(false)
                void load()
              }}
            />
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : modules.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No modules yet. Create your first module above.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {modules.filter(m => filter === "all" || (m.level ?? "tertiary") === filter).map((m) => (
            <li key={m.id}>
              <Link href={`/admin/modules/${m.id}`}>
                <Card className="flex items-center justify-between transition-transform hover:scale-[1.01]">
                  <CardContent className="flex flex-1 items-center justify-between py-4">
                    <div>
                      <p className="font-semibold">
                        {m.title}
                        {m.level === "highschool" && (
                          <span className="ml-2 inline-block rounded-full bg-sky-100 px-2 py-0.5 align-middle text-[11px] font-semibold text-sky-800">
                            High school
                          </span>
                        )}
                      </p>
                      {toPlainText(m.description) && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {toPlainText(m.description)}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {m._count.chapters} chapter{m._count.chapters !== 1 ? "s" : ""}
                        {" · "}
                        {m.courseIds?.length
                          ? m.courseIds.map(id => courseTitles.get(id)).filter(Boolean).join(", ")
                          : "No course"}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
