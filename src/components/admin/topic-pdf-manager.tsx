"use client"

import { useEffect, useRef, useState } from "react"
import { FileText, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TopicPdf {
  id: string
  title: string
  url: string
  createdAt: string
}

interface TopicPdfManagerProps {
  topicId: string
}

export function TopicPdfManager({ topicId }: TopicPdfManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pdfs, setPdfs] = useState<TopicPdf[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    fetch(`/api/topics/${topicId}/pdfs`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load PDFs")
        return res.json() as Promise<TopicPdf[]>
      })
      .then((data) => {
        if (cancelled) return
        setPdfs(data)
        setError("")
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load PDFs")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [topicId])

  async function uploadPdf(file: File) {
    setError("")
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch(`/api/topics/${topicId}/pdfs`, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Upload failed")

      setPdfs((current) => [...current, data])
      if (inputRef.current) inputRef.current.value = ""
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function deletePdf(pdfId: string) {
    const res = await fetch(`/api/topics/${topicId}/pdfs/${pdfId}`, {
      method: "DELETE",
    })
    if (!res.ok) return
    setPdfs((current) => current.filter((pdf) => pdf.id !== pdfId))
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) uploadPdf(file)
        }}
      />

      <div
        className="neo-inset flex flex-col items-center justify-center gap-3 rounded-[var(--neo-radius-lg)] border-2 border-dashed border-foreground/10 p-8 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const file = event.dataTransfer.files?.[0]
          if (file) uploadPdf(file)
        }}
      >
        <Upload className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drop a PDF here or choose one to add it as student content.
        </p>
        <Button
          type="button"
          variant="primary"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Uploading..." : "Upload PDF content"}
        </Button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading PDFs...</p>
      ) : pdfs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No PDF content added yet.</p>
      ) : (
        <div className="space-y-2">
          {pdfs.map((pdf) => (
            <div
              key={pdf.id}
              className="neo-inset flex items-center justify-between gap-3 rounded-[var(--neo-radius)] p-3"
            >
              <a
                href={pdf.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-2 text-sm font-medium hover:text-primary"
              >
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{pdf.title}</span>
              </a>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => deletePdf(pdf.id)}
                title="Delete PDF"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
