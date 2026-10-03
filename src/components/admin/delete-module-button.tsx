"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal, ModalBody, ModalFooter, ModalHeader } from "./modal"

/** Is the signed-in user a superuser? (false until known) */
export function useIsSuperuser() {
  const [superuser, setSuperuser] = useState(false)
  useEffect(() => {
    let live = true
    fetch("/api/profile")
      .then(res => (res.ok ? res.json() : null))
      .then((p: { isSuperuser?: boolean } | null) => live && setSuperuser(!!p?.isSuperuser))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])
  return superuser
}

/** Module code at the start of the title ("MAT1503 - …"), else the whole title */
function confirmWord(title: string) {
  return title.match(/^[A-Z]{3}\d{4}/)?.[0] ?? title.trim()
}

/**
 * "Delete module" button, shown to superusers only (the API checks too).
 * Deleting can't be undone, so they type the module code (or name) to confirm.
 */
export function DeleteModuleButton({
  module,
  chapterCount,
  topicCount,
  hideTrigger = false,
  open: openProp,
  onOpenChange,
}: {
  module: { id: string; title: string }
  chapterCount: number
  topicCount: number
  /** Don't show the button (the window is opened from elsewhere, e.g. Edit module) */
  hideTrigger?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const router = useRouter()
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = (value: boolean) => {
    // Closing clears the confirmation box, so it starts empty next time
    if (!value) {
      setTyped("")
      setError("")
    }
    setOpenState(value)
    onOpenChange?.(value)
  }
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  // Only superusers may delete modules
  const allowed = useIsSuperuser()
  const word = confirmWord(module.title)
  const matches = typed.trim().toLowerCase() === word.toLowerCase()

  const remove = async () => {
    if (!matches) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/modules/${module.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Couldn't delete the module")
      router.push("/admin/modules")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete the module")
      setBusy(false)
    }
  }

  if (!allowed) return null

  return (
    <>
      {!hideTrigger && (
      <Button
        variant="default"
        size="sm"
        onClick={() => {
          setTyped("")
          setError("")
          setOpen(true)
        }}
        className="text-red-600 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
        Delete module
      </Button>
      )}

      <Modal open={open} onClose={() => !busy && setOpen(false)} size="md" persistent={busy}>
        <ModalHeader onClose={busy ? undefined : () => setOpen(false)}>
          <h2 className="text-lg font-semibold">Delete {module.title}?</h2>
        </ModalHeader>
        <ModalBody className="space-y-4">
          <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
            <p className="font-semibold">This can&apos;t be undone.</p>
            <p className="mt-1">
              It deletes the module&apos;s {chapterCount} chapter{chapterCount !== 1 ? "s" : ""} and {topicCount} topic
              {topicCount !== 1 ? "s" : ""}, with their lessons, questions, flashcards and PDFs. Students are removed from the
              module and lose their quiz history for it.
            </p>
          </div>
          <div>
            <label htmlFor="delete-module-confirm" className="mb-1.5 block text-sm font-medium">
              Type <span className="font-mono font-semibold">{word}</span> to confirm
            </label>
            <Input
              id="delete-module-confirm"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              onKeyDown={e => e.key === "Enter" && void remove()}
              autoComplete="off"
              autoFocus
              disabled={busy}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={remove}
            disabled={!matches || busy}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {busy ? "Deleting…" : "Delete module"}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
