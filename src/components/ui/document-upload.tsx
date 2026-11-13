"use client"

import { useRef, useState } from "react"
import { FileText, UploadCloud, X } from "lucide-react"
import { Button } from "./button"
import { cn } from "@/lib/utils"

interface DocumentUploadProps {
  id: string
  accept: string
  multiple?: boolean
  disabled?: boolean
  files: File[]
  onSelect: (files: File[]) => void
  onRemove?: (index: number) => void
  hint: string
  buttonLabel?: string
  showFiles?: boolean
}

export function DocumentUpload({ id, accept, multiple = false, disabled = false, files, onSelect, onRemove, hint, buttonLabel, showFiles = true }: DocumentUploadProps) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  function select(incoming: File[]) {
    if (!disabled && incoming.length) onSelect(multiple ? incoming : incoming.slice(0, 1))
  }
  return <div className="space-y-3">
    <div
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false) }}
      onDrop={e => { e.preventDefault(); setDragging(false); select(Array.from(e.dataTransfer.files)) }}
      className={cn("rounded-2xl border-2 border-dashed p-5 text-center transition-colors sm:p-6", dragging && !disabled ? "border-foreground bg-muted" : "border-border bg-muted/30", disabled && "opacity-60")}
    >
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-background shadow-sm"><UploadCloud className="h-6 w-6 text-foreground" aria-hidden="true" /></div>
      <p className="mb-1 text-sm font-semibold">{dragging ? "Drop your documents here" : "Drag and drop your documents here"}</p>
      <p id={`${id}-hint`} className="mb-4 text-xs text-muted-foreground">{hint}</p>
      <input ref={input} id={id} type="file" accept={accept} multiple={multiple} disabled={disabled} tabIndex={-1} aria-hidden="true" className="hidden" onChange={e => { select(Array.from(e.target.files ?? [])); e.target.value = "" }} />
      <Button type="button" variant="primary" disabled={disabled} aria-describedby={`${id}-hint`} onClick={() => input.current?.click()} className="min-h-11 w-full gap-2 px-6 sm:w-auto">
        <UploadCloud className="h-4 w-4" aria-hidden="true" />{buttonLabel ?? (files.length ? multiple ? "Choose more documents" : "Replace document" : multiple ? "Choose documents" : "Choose document")}
      </Button>
      <p role="status" className="mt-3 text-xs text-muted-foreground">{files.length ? `${files.length} ${files.length === 1 ? "file" : "files"} selected` : "No files selected yet"}</p>
    </div>
    {showFiles && files.length > 0 && <ul className="space-y-2" aria-label="Selected documents">{files.map((file, index) => <li key={`${file.name}:${file.lastModified}:${index}`} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-3">
      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1"><p className="break-all text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{file.size >= 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.ceil(file.size / 1024))} KB`}</p></div>
      {onRemove && <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`Remove ${file.name}`} onClick={() => onRemove(index)}><X className="h-4 w-4" aria-hidden="true" /></Button>}
    </li>)}</ul>}
  </div>
}
