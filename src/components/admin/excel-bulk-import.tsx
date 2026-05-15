"use client"

import { useRef, useState } from "react"
import { Download, FileSpreadsheet, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ExcelBulkImportProps {
  topicId: string
  type: "questions" | "flashcards"
  onImported: () => void
}

const CONFIG = {
  questions: {
    title: "Bulk upload questions (Excel)",
    description:
      "Download the template, fill in questions with options, then upload. correct_option must exactly match one option column.",
    templateUrl: "/api/admin/templates/questions",
    templateFilename: "tyro-questions-template.xlsx",
    importUrl: "/api/questions/import",
    accept: ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel",
  },
  flashcards: {
    title: "Bulk upload flashcards (Excel)",
    description:
      "Download the template with front and back columns, fill in your cards, then upload.",
    templateUrl: "/api/admin/templates/flashcards",
    templateFilename: "tyro-flashcards-template.xlsx",
    importUrl: "/api/flashcards/import",
    accept: ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel",
  },
} as const

export function ExcelBulkImport({
  topicId,
  type,
  onImported,
}: ExcelBulkImportProps) {
  const cfg = CONFIG[type]
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [details, setDetails] = useState<string[]>([])

  async function downloadTemplate() {
    setDownloading(true)
    setError("")
    try {
      const res = await fetch(cfg.templateUrl)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to download template")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = cfg.templateFilename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed")
    } finally {
      setDownloading(false)
    }
  }

  async function handleUpload(file: File) {
    setLoading(true)
    setError("")
    setMessage("")
    setDetails([])

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("topicId", topicId)

      const res = await fetch(cfg.importUrl, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        if (Array.isArray(data.details)) {
          setDetails(data.details)
        }
        throw new Error(data.error ?? "Import failed")
      }

      setMessage(data.message ?? `Imported ${data.count} items`)
      onImported()
      if (inputRef.current) inputRef.current.value = ""
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{cfg.description}</p>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={downloading}
          onClick={downloadTemplate}
        >
          <Download className="h-4 w-4" />
          {downloading ? "Downloading…" : "Download template"}
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={cfg.accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleUpload(file)
        }}
      />

      <div className="neo-inset flex flex-col items-center gap-3 rounded-[var(--neo-radius-lg)] p-6 text-center">
        <FileSpreadsheet className="h-10 w-10 text-primary" />
        <p className="text-sm text-muted-foreground">
          Upload your completed Excel file
        </p>
        <Button
          type="button"
          variant="primary"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          {loading ? "Importing…" : "Upload Excel"}
        </Button>
      </div>

      {message && (
        <p className="text-sm font-medium text-accent">{message}</p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {details.length > 0 && (
        <ul className="neo-inset max-h-40 overflow-y-auto rounded-[var(--neo-radius)] p-3 text-xs text-red-500">
          {details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
