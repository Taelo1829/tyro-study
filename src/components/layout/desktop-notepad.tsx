"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { Check, Download, Minus, NotebookPen, Plus, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  caretAtEndOf,
  caretRange,
  convertMatrixAtCaret,
  exitScript,
  handleScriptKey,
  isEditorEmpty,
  isScriptEmpty,
  placeCaret,
  placeCaretAtEnd,
  readRows,
  renderMatrix,
  sanitizeNotes,
  scriptAt,
  serialize,
  textToHtml,
  type ScriptKind,
} from "./notepad-dom"

/**
 * Desktop-only notepad, opened from a floating button in the bottom-left
 * corner of every signed-in page. Maths formats as you type:
 *  - ^ starts a superscript, _ a subscript. Space, →, Enter, Esc or typing
 *    ^ again finishes it; Backspace on an empty one gives back the plain ^ / _.
 *  - A matrix typed as [[1 2] [3 4]], [[1, 2], [3, 4]] or one row per line
 *    becomes a matrix as soon as its last ] is typed. Its pencil button edits it.
 *
 * Notes are saved in this browser (localStorage) per account. Nothing goes
 * to the server. Hidden below `lg`, where the mobile bottom bar takes over.
 */

const htmlKey = (userId?: string) => `tyro:notepad-html:${userId ?? "anon"}`
// The first version stored plain text here; it's carried over once
const textKey = (userId?: string) => `tyro:notepad:${userId ?? "anon"}`

function loadNotes(userId?: string): string {
  try {
    const html = localStorage.getItem(htmlKey(userId))
    if (html !== null) return sanitizeNotes(html)
    const text = localStorage.getItem(textKey(userId))
    return text ? textToHtml(text) : ""
  } catch {
    return ""
  }
}

function storeNotes(userId: string | undefined, html: string) {
  try {
    if (html) localStorage.setItem(htmlKey(userId), html)
    else localStorage.removeItem(htmlKey(userId))
    return true
  } catch {
    return false
  }
}

interface MatrixEdit {
  el: HTMLElement
  rows: string[][]
}

export function DesktopNotepad() {
  const { data: session } = useSession()
  const userId = session?.user?.id

  const editorRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(true)
  const [empty, setEmpty] = useState(true)
  const [words, setWords] = useState(0)
  const [scriptMode, setScriptMode] = useState<ScriptKind | null>(null)
  const [editing, setEditing] = useState<MatrixEdit | null>(null)

  const save = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const isEmpty = isEditorEmpty(editor)
    setEmpty(isEmpty)
    const text = serialize(editor, "export").text.trim()
    setWords(text ? text.split(/\s+/).length : 0)
    setSaved(storeNotes(userId, isEmpty ? "" : editor.innerHTML))
  }, [userId])

  // Load saved notes each time it opens (another tab may have changed them)
  useEffect(() => {
    const editor = editorRef.current
    if (!open || !editor) return
    editor.innerHTML = loadNotes(userId)
    setEmpty(isEditorEmpty(editor))
    const text = serialize(editor, "export").text.trim()
    setWords(text ? text.split(/\s+/).length : 0)
    editor.focus()
    placeCaretAtEnd(editor)
  }, [open, userId])

  // Esc closes the notepad (when not finishing a superscript or editing a matrix)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  // Show when the caret is inside a superscript/subscript
  useEffect(() => {
    if (!open) return
    const onSelection = () => {
      const editor = editorRef.current
      const range = editor && caretRange(editor)
      const script = editor && range ? scriptAt(editor, range.startContainer) : null
      setScriptMode(script ? (script.tagName === "SUP" ? "sup" : "sub") : null)
    }
    document.addEventListener("selectionchange", onSelection)
    return () => document.removeEventListener("selectionchange", onSelection)
  }, [open])

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const editor = editorRef.current
    const range = editor && caretRange(editor)
    const script = editor && range ? scriptAt(editor, range.startContainer) : null
    if (!editor || !range || !script) return

    if (e.key === " ") {
      e.preventDefault()
      exitScript(script, " ")
      save()
    } else if (e.key === "Enter") {
      // Leave the script, then let the browser add the new line
      exitScript(script)
    } else if (e.key === "Escape" || e.key === "Tab" || (e.key === "ArrowRight" && caretAtEndOf(script, range))) {
      e.preventDefault()
      e.stopPropagation()
      exitScript(script)
    } else if (e.key === "Backspace" && isScriptEmpty(script)) {
      // An empty superscript turns back into a plain ^ (how to type a literal ^)
      e.preventDefault()
      const plain = document.createTextNode(script.tagName === "SUP" ? "^" : "_")
      script.replaceWith(plain)
      placeCaret(plain, 1)
      save()
    }
  }

  const onInput = (e: React.FormEvent<HTMLDivElement>) => {
    const editor = editorRef.current
    if (!editor) return
    const input = e.nativeEvent as InputEvent
    if (input.inputType === "insertText" && (input.data === "^" || input.data === "_")) {
      handleScriptKey(editor, input.data)
    } else if (input.data?.endsWith("]")) {
      convertMatrixAtCaret(editor)
    }
    save()
  }

  // Paste as plain text (no styles from other sites); a pasted matrix still converts
  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"))
  }

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const button = (e.target as HTMLElement).closest("[data-matrix-edit]")
    const el = button?.closest<HTMLElement>("[data-matrix]")
    if (!el) return
    e.preventDefault()
    setEditing({ el, rows: readRows(el) })
  }

  const finishEdit = (rows: string[][] | null) => {
    if (!editing) return
    if (rows === null) editing.el.remove()
    else renderMatrix(editing.el, rows.map(r => r.map(c => c.trim() || "0")))
    setEditing(null)
    save()
    editorRef.current?.focus()
  }

  const clear = () => {
    const editor = editorRef.current
    if (!editor || (!empty && !window.confirm("Clear everything in your notepad?"))) return
    editor.replaceChildren()
    save()
    editor.focus()
  }

  const download = () => {
    const editor = editorRef.current
    if (!editor) return
    const blob = new Blob([serialize(editor, "export").text], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `tyro-notes-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="hidden lg:block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={open ? "Close notepad" : "Open notepad"}
        title="Notepad"
        className={cn(
          "fixed bottom-8 left-8 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-xl shadow-black/20 transition-transform hover:scale-105 active:scale-95",
          open ? "bg-card text-foreground ring-1 ring-border" : "bg-primary text-primary-foreground"
        )}
      >
        {open ? <X className="h-6 w-6" /> : <NotebookPen className="h-6 w-6" />}
      </button>

      {open && (
        <section
          aria-label="Notepad"
          className="fixed bottom-28 left-8 z-40 flex h-[520px] max-h-[calc(100dvh-10rem)] w-[420px] flex-col overflow-hidden rounded-[var(--neo-radius-lg)] bg-card shadow-2xl shadow-black/20 ring-1 ring-border"
        >
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <NotebookPen className="h-4 w-4 text-primary" />
            <h2 className="flex-1 text-sm font-semibold">Notepad</h2>
            <button
              type="button"
              onClick={download}
              disabled={empty}
              aria-label="Download notes as a text file"
              title="Download as .txt"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close notepad"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="relative min-h-0 flex-1">
            {empty && (
              <p className="pointer-events-none absolute left-4 right-4 top-3 text-base text-muted-foreground">
                Jot down anything. Type <b>^</b> for a power (k^2), or a matrix like{" "}
                <span className="whitespace-nowrap">[[1 2] [3 4]]</span>.
              </p>
            )}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label="Notes"
              spellCheck
              onKeyDown={onKeyDown}
              onInput={onInput}
              onPaste={onPaste}
              onClick={onClick}
              className="h-full overflow-y-auto whitespace-pre-wrap break-words px-4 py-3 text-base leading-8 text-foreground outline-none [&_sub]:text-[0.75em] [&_sup]:text-[0.75em]"
            />

            {editing && (
              <MatrixEditor initial={editing.rows} onDone={finishEdit} onCancel={() => setEditing(null)} />
            )}
          </div>

          <footer className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              {scriptMode ? (
                <span className="font-medium text-primary">
                  Typing {scriptMode === "sup" ? "superscript" : "subscript"}: Space or → to finish
                </span>
              ) : saved ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Saved on this device
                  {words > 0 && <span className="ml-1">· {words} words</span>}
                </>
              ) : (
                "Couldn't save (browser storage is blocked)"
              )}
            </span>
            {!empty && (
              <button
                type="button"
                onClick={clear}
                className="flex items-center gap-1 rounded-full px-2 py-1 hover:bg-muted hover:text-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </footer>
        </section>
      )}
    </div>
  )
}

/** Cell-by-cell editor for a matrix block, shown over the notes */
function MatrixEditor({
  initial,
  onDone,
  onCancel,
}: {
  initial: string[][]
  onDone: (rows: string[][] | null) => void
  onCancel: () => void
}) {
  const [rows, setRows] = useState(() => (initial.length ? initial.map(r => [...r]) : [[""]]))
  const width = rows[0]?.length ?? 1

  const setCell = (r: number, c: number, value: string) =>
    setRows(prev => prev.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? value : cell)) : row)))
  const addRow = () => setRows(prev => [...prev, Array<string>(width).fill("")])
  const removeRow = () => setRows(prev => (prev.length > 1 ? prev.slice(0, -1) : prev))
  const addColumn = () => setRows(prev => prev.map(row => [...row, ""]))
  const removeColumn = () => setRows(prev => (width > 1 ? prev.map(row => row.slice(0, -1)) : prev))

  const sizeButton =
    "flex h-7 w-7 items-center justify-center rounded-full bg-muted text-foreground hover:bg-primary hover:text-primary-foreground disabled:pointer-events-none disabled:opacity-40"

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col bg-card"
      role="dialog"
      aria-label="Edit matrix"
      onKeyDown={e => {
        if (e.key === "Escape") {
          e.stopPropagation()
          onCancel()
        } else if (e.key === "Enter") {
          e.preventDefault()
          onDone(rows)
        }
      }}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h3 className="text-sm font-semibold">
          Edit matrix <span className="font-normal text-muted-foreground">({rows.length} × {width})</span>
        </h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            Rows
            <button type="button" onClick={removeRow} disabled={rows.length <= 1} className={sizeButton} aria-label="Remove a row">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={addRow} className={sizeButton} aria-label="Add a row">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </span>
          <span className="flex items-center gap-1">
            Cols
            <button type="button" onClick={removeColumn} disabled={width <= 1} className={sizeButton} aria-label="Remove a column">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={addColumn} className={sizeButton} aria-label="Add a column">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="inline-grid gap-2" style={{ gridTemplateColumns: `repeat(${width}, minmax(3.5rem, 6rem))` }}>
          {rows.flatMap((row, r) =>
            row.map((cell, c) => (
              <input
                key={`${r}-${c}`}
                value={cell}
                onChange={e => setCell(r, c, e.target.value)}
                autoFocus={r === 0 && c === 0}
                aria-label={`Row ${r + 1}, column ${c + 1}`}
                className="rounded-md bg-muted px-2 py-1.5 text-center text-sm text-foreground outline-none ring-primary focus:ring-2"
              />
            ))
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Use ^ for powers in a cell, e.g. k^2 + 1. Empty cells become 0.</p>
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-2">
        <button
          type="button"
          onClick={() => onDone(null)}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
        >
          <Trash2 className="h-4 w-4" /> Delete
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-1.5 text-sm text-muted-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onDone(rows)}
            className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
