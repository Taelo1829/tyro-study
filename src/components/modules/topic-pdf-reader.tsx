"use client"

import { useEffect, useState } from "react"
import { ExternalLink, FileText } from "lucide-react"

interface TopicPdf {
  id: string
  title: string
  url: string
}

interface TopicPdfReaderProps {
  topicId: string
}

export function TopicPdfReader({ topicId }: TopicPdfReaderProps) {
  const [pdfs, setPdfs] = useState<TopicPdf[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch(`/api/topics/${topicId}/pdfs`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: TopicPdf[]) => {
        if (cancelled) return
        setPdfs(data)
        setSelectedId(data[0]?.id ?? null)
      })

    return () => {
      cancelled = true
    }
  }, [topicId])

  if (pdfs.length === 0) return null

  const selectedPdf = pdfs.find((pdf) => pdf.id === selectedId) ?? pdfs[0]

  return (
    <div className="space-y-4">
      {/* Pick a document when the topic has more than one */}
      {pdfs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label="Documents">
          {pdfs.map((pdf) => (
            <button
              key={pdf.id}
              type="button"
              role="tab"
              aria-selected={pdf.id === selectedPdf.id}
              onClick={() => setSelectedId(pdf.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                pdf.id === selectedPdf.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-4 w-4" />
              <span className="max-w-[14rem] truncate">{pdf.title.replace(/\.pdf$/i, "")}</span>
            </button>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-[var(--neo-radius-lg)] border border-foreground/10">
        <div className="flex items-center gap-2 border-b border-foreground/10 bg-muted/60 px-4 py-2.5">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{selectedPdf.title.replace(/\.pdf$/i, "")}</p>
          <a
            href={selectedPdf.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-card hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open
          </a>
        </div>
        <iframe
          key={selectedPdf.id}
          src={selectedPdf.url}
          title={selectedPdf.title}
          className="h-[70dvh] min-h-[420px] w-full bg-white"
        />
      </div>
    </div>
  )
}
