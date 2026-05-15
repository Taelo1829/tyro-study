"use client"

import { useRef, useState } from "react"
import { FileUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ExtractedQuestion } from "@/lib/ai/question-generator"

interface PdfUploaderProps {
  onExtracted: (questions: ExtractedQuestion[]) => void
}

export function PdfUploader({ onExtracted }: PdfUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fileName, setFileName] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError("")
    setLoading(true)
    setFileName(file.name)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/ai/extract-questions", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? "Extraction failed")
      }

      onExtracted(data.questions)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
      <div
        className="neo-inset flex flex-col items-center justify-center gap-3 rounded-[var(--neo-radius-lg)] border-2 border-dashed border-foreground/10 p-8 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files?.[0]
          if (file) handleFile(file)
        }}
      >
        <FileUp className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {fileName ?? "Drop a PDF or click to upload"}
        </p>
        <Button
          type="button"
          variant="primary"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
        >
          {loading ? "Extracting questions…" : "Upload PDF"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
