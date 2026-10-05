"use client"

import { toPlainText } from "@/lib/plain-text"
import { useState } from "react"
import Link from "next/link"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal, ModalBody, ModalFooter, ModalHeader } from "./modal"
import { DeleteModuleButton, useIsSuperuser } from "./delete-module-button"

interface CourseLink {
  id: string
  title: string
}

interface EditModuleButtonProps {
  module: { id: string; title: string; description: string | null; courses?: CourseLink[] }
  onSaved: (updated: { title: string; description: string | null; courses: CourseLink[] }) => void
  /** For the delete warning (superusers can delete from this window) */
  chapterCount?: number
  topicCount?: number
}

/** "Edit module" button + pop-up for changing a module's name and description */
export function EditModuleButton({ module, onSaved, chapterCount = 0, topicCount = 0 }: EditModuleButtonProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(module.title)
  const [description, setDescription] = useState(toPlainText(module.description))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const superuser = useIsSuperuser()
  // Every course (loaded when the window opens) and the ones this module is in
  const [allCourses, setAllCourses] = useState<CourseLink[] | null>(null)
  const startCourseIds = (module.courses ?? []).map(c => c.id)
  const [courseIds, setCourseIds] = useState<string[]>(startCourseIds)

  function openEditor() {
    // Start from the current values each time
    setTitle(module.title)
    setDescription(toPlainText(module.description))
    setCourseIds(startCourseIds)
    setError("")
    setOpen(true)
    fetch("/api/courses")
      .then(r => (r.ok ? r.json() : []))
      .then((list: CourseLink[]) => setAllCourses(list.map(({ id, title }) => ({ id, title }))))
      .catch(() => setAllCourses([]))
  }

  const coursesChanged =
    courseIds.length !== startCourseIds.length || courseIds.some(id => !startCourseIds.includes(id))
  const unchanged =
    title.trim() === module.title && description.trim() === toPlainText(module.description) && !coursesChanged

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError("The module needs a name.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/modules/${module.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          ...(coursesChanged && { courseIds }),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the module")
      const courses = coursesChanged
        ? (allCourses ?? []).filter(c => courseIds.includes(c.id))
        : module.courses ?? []
      onSaved({ title: data.title, description: data.description, courses })
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the module")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button variant="default" size="sm" onClick={openEditor}>
        <Pencil className="h-4 w-4" />
        Edit module
      </Button>

      <Modal open={open} onClose={() => !saving && setOpen(false)} size="md">
        <form onSubmit={save}>
          <ModalHeader onClose={() => !saving && setOpen(false)}>Edit module</ModalHeader>
          <ModalBody className="space-y-4">
            <div>
              <label htmlFor="module-title" className="mb-1.5 block text-sm font-medium">Name</label>
              <Input
                id="module-title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                disabled={saving}
                maxLength={200}
                placeholder="e.g. MAT1503 - Linear Algebra I"
                autoFocus
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Keep the UNISA module code at the start (e.g. COS1511). The AI uses it to pitch lessons and questions at the right year level.
              </p>
            </div>
            <div>
              <label htmlFor="module-description" className="mb-1.5 block text-sm font-medium">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="module-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={saving}
                rows={4}
                maxLength={2000}
                placeholder="What the module covers. Students see this before they join."
                className="neo-inset w-full resize-y rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">
                Courses <span className="font-normal text-muted-foreground">(a module can be in several)</span>
              </legend>
              {allCourses === null ? (
                <p className="text-sm text-muted-foreground">Loading courses…</p>
              ) : allCourses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No courses yet.{" "}
                  <Link href="/admin/courses" className="font-medium text-primary hover:underline">
                    Create one
                  </Link>
                  .
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allCourses.map(c => {
                    const on = courseIds.includes(c.id)
                    return (
                      <label
                        key={c.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${on ? "border-foreground bg-foreground text-background" : "border-border bg-white"}`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={on}
                          disabled={saving}
                          onChange={() =>
                            setCourseIds(prev => (on ? prev.filter(id => id !== c.id) : [...prev, c.id]))
                          }
                        />
                        {c.title}
                      </label>
                    )
                  })}
                </div>
              )}
            </fieldset>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          </ModalBody>
          <ModalFooter align="between">
            {superuser ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setDeleteOpen(true)
                }}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-full px-2 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete module
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving || unchanged || !title.trim()}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            </div>
          </ModalFooter>
        </form>
      </Modal>

      {superuser && (
        <DeleteModuleButton
          module={module}
          chapterCount={chapterCount}
          topicCount={topicCount}
          hideTrigger
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      )}
    </>
  )
}
