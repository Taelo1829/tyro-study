"use client"

import { useRef, useState } from "react"
import { BookOpen, FileText, Upload, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal, ModalBody, ModalHeader } from "./modal"

interface TextbookUploaderProps {
  moduleId: string
  onUploaded: () => void
}

interface UploadResult {
  success: boolean
  summary: {
    totalExtracted: number
    matchedTopics: number
    uploadedQuestions: number
    skippedQuestions: number
  }
  details: {
    matchedTopics: Array<{
      topicId: string
      topicTitle: string
      questionsUploaded: number
    }>
    skippedQuestionsCount: number
  }
}

export function TextbookUploader({ moduleId, onUploaded }: TextbookUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fileName, setFileName] = useState<string | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [open, setOpen] = useState(false)

  function close() {
    if (loading) return // don't close mid-upload
    setOpen(false)
    // Start fresh next time it's opened
    setError("")
    setResult(null)
    setFileName(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  async function handleFile(file: File) {
    setError("")
    setResult(null)
    setLoading(true)
    setFileName(file.name)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch(`/api/modules/${moduleId}/textbook-upload`, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? "Upload failed")
      }

      setResult(data)
      onUploaded()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <BookOpen className="h-4 w-4" />
        Upload textbook
      </Button>

      <Modal open={open} onClose={close} size="md" persistent={loading}>
        <ModalHeader onClose={loading ? undefined : close}>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BookOpen className="h-5 w-5" />
            Upload textbook
          </h2>
        </ModalHeader>
        <ModalBody className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload a PDF textbook to automatically extract questions and allocate them to existing topics. 
          Questions will only be uploaded to topics that already exist in this module.
        </p>

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
          className="flex flex-col items-center justify-center gap-3 rounded-[var(--neo-radius-lg)] border-2 border-dashed border-border bg-muted p-8 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const file = e.dataTransfer.files?.[0]
            if (file) handleFile(file)
          }}
        >
          <FileText className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {fileName ?? "Drop a PDF textbook or click to upload"}
          </p>
          <Button
            type="button"
            variant="primary"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {loading ? "Processing textbook…" : "Upload PDF"}
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="tint-mint flex items-start gap-2 rounded-2xl p-3 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Textbook processed successfully!</p>
                <p className="text-xs mt-1">
                  {result.summary.uploadedQuestions} questions uploaded to {result.summary.matchedTopics} topics
                  {result.summary.skippedQuestions > 0 && ` (${result.summary.skippedQuestions} skipped - no matching topic)`}
                </p>
              </div>
            </div>

            {result.details.matchedTopics.length > 0 && (
              <div className="rounded-2xl bg-muted p-3">
                <p className="text-sm font-medium mb-2">Questions allocated to topics:</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {result.details.matchedTopics.map((topic) => (
                    <li key={topic.topicId} className="flex justify-between">
                      <span>{topic.topicTitle}</span>
                      <span>{topic.questionsUploaded} questions</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        </ModalBody>
      </Modal>
    </>
  )
}
