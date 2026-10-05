"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowDown, ArrowUp, GraduationCap, ListChecks, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react"
import { Header } from "@/components/layout/header"
import { EntityForm } from "@/components/admin/entity-form"
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/admin/modal"
import { CourseImport } from "@/components/admin/course-import"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toPlainText } from "@/lib/plain-text"
import { ModuleBuilder } from "@/components/admin/module-builder"
import { LevelPicker } from "@/components/auth/level-picker"
import { gradeOfTitle, type StudyLevel } from "@/lib/levels"

interface Course {
  id: string
  title: string
  description: string | null
  moduleIds: string[]
  /** highschool: a grade (Grade 11, Grade 12) holding subjects */
  level?: StudyLevel
}

interface ModuleLite {
  id: string
  title: string
}

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [modules, setModules] = useState<ModuleLite[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Course | null>(null)
  const [picking, setPicking] = useState<Course | null>(null)
  const [building, setBuilding] = useState<Course | null>(null)
  const [newLevel, setNewLevel] = useState<StudyLevel>("tertiary")

  const load = useCallback(async () => {
    const [c, m] = await Promise.all([fetch("/api/courses"), fetch("/api/modules")])
    if (c.ok) setCourses(await c.json())
    if (m.ok) setModules(((await m.json()) as ModuleLite[]).map(({ id, title }) => ({ id, title })))
    setLoading(false)
  }, [])

  useEffect(() => {
    queueMicrotask(load)
  }, [load])

  const moduleById = useMemo(() => new Map(modules.map(m => [m.id, m])), [modules])
  const inAnyCourse = new Set(courses.flatMap(c => c.moduleIds))
  const loose = modules.filter(m => !inAnyCourse.has(m.id))

  async function remove(course: Course) {
    if (!confirm(`Delete the course "${course.title}"? Its modules are kept; they just leave this course.`)) return
    const res = await fetch(`/api/courses/${course.id}`, { method: "DELETE" })
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error ?? "Couldn't delete the course")
      return
    }
    setCourses(prev => prev.filter(c => c.id !== course.id))
  }

  return (
    <>
      <Header title="Courses and grades" subtitle="Top of the hierarchy: Course → Module → Chapter → Topic (high school: Grade → Subject → Chapter → Topic)" />

      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary">
          ← Admin
        </Link>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" />
          New course
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create {newLevel === "highschool" ? "a grade" : "a course"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <LevelPicker value={newLevel} onChange={setNewLevel} name="course-level" />
            </div>
            <EntityForm
              fields={[
                { name: "title", label: "Name", required: true, placeholder: "e.g. BSc Computing" },
                { name: "description", label: "Description", type: "textarea", placeholder: "Who the course is for. Students see this when browsing." },
              ]}
              submitLabel="Create course"
              onCancel={() => setShowForm(false)}
              onSubmit={async values => {
                const res = await fetch("/api/courses", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ...values, level: newLevel }),
                })
                const data = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(data.error ?? "Failed to create the course")
                setCourses(prev => [...prev, data as Course].sort((a, b) => a.title.localeCompare(b.title)))
                setShowForm(false)
                // Straight on to filling it: with AI (university courses), or by choosing modules
                if (newLevel === "highschool") setPicking(data as Course)
                else setBuilding(data as Course)
              }}
            />
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-3">
          {courses.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No courses yet. Create one (e.g. BSc Computing), then build it with AI from its UNISA page or choose the
                modules that belong to it.
              </CardContent>
            </Card>
          )}

          {courses.map(course => (
            <Card key={course.id}>
              <CardContent className="py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold">
                      <GraduationCap className="h-4 w-4 shrink-0 text-primary" />
                      {course.title}
                      {course.level === "highschool" && (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">High school</span>
                      )}
                    </p>
                    {toPlainText(course.description) && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{toPlainText(course.description)}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {course.level === "highschool" ? (
                      <ModuleBuilder onAdded={() => void load()} defaultGrade={gradeOfTitle(course.title) ?? 12} />
                    ) : (
                      <Button size="sm" variant="primary" onClick={() => setBuilding(course)}>
                        <Sparkles className="h-4 w-4" />
                        Build with AI
                      </Button>
                    )}
                    <Button size="sm" onClick={() => setPicking(course)}>
                      <ListChecks className="h-4 w-4" />
                      Modules
                    </Button>
                    <Button size="sm" onClick={() => setEditing(course)} aria-label={`Edit ${course.title}`}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(course)} aria-label={`Delete ${course.title}`} className="text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {course.moduleIds.length} {course.level === "highschool" ? "subject" : "module"}{course.moduleIds.length !== 1 ? "s" : ""}
                </p>
                {course.moduleIds.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {course.moduleIds.map(id => (
                      <li key={id}>
                        <Link
                          href={`/admin/modules/${id}`}
                          className="inline-block rounded-full border border-border bg-white px-3 py-1 text-xs hover:border-foreground"
                        >
                          {moduleById.get(id)?.title ?? "Unknown module"}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">No modules yet. Use “Modules” to add some.</p>
                )}
              </CardContent>
            </Card>
          ))}

          {loose.length > 0 && (
            <Card>
              <CardContent className="py-5">
                <p className="font-semibold">Other modules</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Not in any course yet. Students still find them under “Other modules”.
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {loose.map(m => (
                    <li key={m.id}>
                      <Link
                        href={`/admin/modules/${m.id}`}
                        className="inline-block rounded-full border border-dashed border-border bg-white px-3 py-1 text-xs hover:border-foreground"
                      >
                        {m.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {editing && (
        <EditCourseModal
          course={editing}
          onClose={() => setEditing(null)}
          onSaved={updated => {
            setCourses(prev => prev.map(c => (c.id === updated.id ? updated : c)))
            setEditing(null)
          }}
        />
      )}

      {building && (
        <CourseImport
          course={building}
          open
          onClose={() => setBuilding(null)}
          onChanged={() => void load()}
          onChooseManually={() => {
            const course = courses.find(c => c.id === building.id) ?? building
            setBuilding(null)
            setPicking(course)
          }}
        />
      )}

      {picking && (
        <CourseModulesModal
          course={picking}
          modules={modules}
          onClose={() => setPicking(null)}
          onSaved={updated => {
            setCourses(prev => prev.map(c => (c.id === updated.id ? updated : c)))
            setPicking(null)
          }}
        />
      )}
    </>
  )
}

function EditCourseModal({ course, onClose, onSaved }: { course: Course; onClose: () => void; onSaved: (c: Course) => void }) {
  const [title, setTitle] = useState(course.title)
  const [description, setDescription] = useState(toPlainText(course.description))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the course")
      onSaved(data as Course)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the course")
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={() => !saving && onClose()} size="md">
      <form onSubmit={save}>
        <ModalHeader onClose={() => !saving && onClose()}>Edit course</ModalHeader>
        <ModalBody className="space-y-4">
          <div>
            <label htmlFor="course-title" className="mb-1.5 block text-sm font-medium">Name</label>
            <Input id="course-title" value={title} onChange={e => setTitle(e.target.value)} disabled={saving} maxLength={200} autoFocus />
          </div>
          <div>
            <label htmlFor="course-description" className="mb-1.5 block text-sm font-medium">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="course-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={saving}
              rows={3}
              maxLength={2000}
              className="neo-inset w-full resize-y rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving || !title.trim()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}

/** Choose which modules are in a course, and their order */
function CourseModulesModal({
  course,
  modules,
  onClose,
  onSaved,
}: {
  course: Course
  modules: ModuleLite[]
  onClose: () => void
  onSaved: (c: Course) => void
}) {
  const byId = new Map(modules.map(m => [m.id, m]))
  const [selected, setSelected] = useState<string[]>(course.moduleIds.filter(id => byId.has(id)))
  const [query, setQuery] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const available = modules.filter(
    m => !selected.includes(m.id) && words.every(w => m.title.toLowerCase().includes(w))
  )

  function move(index: number, by: -1 | 1) {
    setSelected(prev => {
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(index + by, 0, item)
      return next
    })
  }

  async function save() {
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/courses/${course.id}/modules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleIds: selected }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the modules")
      onSaved(data as Course)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the modules")
      setSaving(false)
    }
  }

  const iconBtn = "flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"

  return (
    <Modal open onClose={() => !saving && onClose()} size="lg">
      <ModalHeader onClose={() => !saving && onClose()}>
        <p className="font-semibold">Modules in {course.title}</p>
        <p className="mt-0.5 text-sm font-normal text-muted-foreground">
          A module can be in more than one course. Students see them in this order.
        </p>
      </ModalHeader>
      <ModalBody className="space-y-5">
        <section>
          <h3 className="mb-2 text-sm font-semibold">In this course ({selected.length})</h3>
          {selected.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              Nothing yet. Add modules from the list below.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {selected.map((id, i) => (
                <li key={id} className="flex items-center gap-2 rounded-2xl border border-border bg-white py-1.5 pl-4 pr-1.5">
                  <span className="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{byId.get(id)?.title}</span>
                  <button type="button" className={iconBtn} onClick={() => move(i, -1)} disabled={i === 0 || saving} aria-label="Move up">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button type="button" className={iconBtn} onClick={() => move(i, 1)} disabled={i === selected.length - 1 || saving} aria-label="Move down">
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    onClick={() => setSelected(prev => prev.filter(x => x !== id))}
                    disabled={saving}
                    aria-label={`Remove ${byId.get(id)?.title}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Add modules</h3>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search modules"
              aria-label="Search modules to add"
              className="h-11 w-full rounded-full border border-border bg-white pl-11 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>
          {available.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">
              {modules.length === selected.length ? "Every module is already in this course." : "No modules match."}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {available.map(m => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(prev => [...prev, m.id])}
                    disabled={saving}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border px-4 py-2.5 text-left text-sm hover:border-foreground disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate">{m.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="button" variant="primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save modules"}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
