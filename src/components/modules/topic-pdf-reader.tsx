"use client"

import { useEffect, useState } from "react"
import { ExternalLink, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

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
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">PDF content</h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {pdfs.map((pdf) => (
          <button
            key={pdf.id}
            type="button"
            onClick={() => setSelectedId(pdf.id)}
            className={`rounded-[var(--neo-radius)] px-3 py-2 text-sm transition ${
              pdf.id === selectedPdf.id
                ? "neo-pressed text-primary"
                : "neo-button text-muted-foreground"
            }`}
          >
            {pdf.title}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-[var(--neo-radius-lg)] border border-foreground/10">
        <iframe
          src={selectedPdf.url}
          title={selectedPdf.title}
          className="h-[70vh] w-full bg-white"
        />
      </div>

      <Button asChild variant="default">
        <a href={selectedPdf.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-4 w-4" />
          Open PDF in new tab
        </a>
      </Button>
    </div>
  )
}
