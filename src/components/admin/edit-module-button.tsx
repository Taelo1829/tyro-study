"use client"

import { toPlainText } from "@/lib/plain-text"
import { useState } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal, ModalBody, ModalFooter, ModalHeader } from "./modal"
import { DeleteModuleButton, useIsSuperuser } from "./delete-module-button"

interface EditModuleButtonProps {
  module: { id: string; title: string; description: string | null }
  onSaved: (updated: { title: string; description: string | null }) => void
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

  function openEditor() {
    // Start from the current values each time
    setTitle(module.title)
    setDescription(toPlainText(module.description))
    setError("")
    setOpen(true)
  }

  const unchanged = title.trim() === module.title && description.trim() === toPlainText(module.description)

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
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the module")
      onSaved({ title: data.title, description: data.description })
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
