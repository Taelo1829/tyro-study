"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ContentManagerProps {
  topicId: string
  initialContent: string
  onSaved: () => void
}

export function ContentManager({
  topicId,
  initialContent,
  onSaved,
}: ContentManagerProps) {
  const [content, setContent] = useState(initialContent)
  const [loading, setLoading] = useState(false)
  const [flashLoading, setFlashLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function saveContent() {
    setLoading(true)
    setMessage("")
    try {
      const res = await fetch(`/api/topics/${topicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Save failed")
      }
      setMessage("Content saved")
      onSaved()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed")
    } finally {
      setLoading(false)
    }
  }

  async function generateFlashcards() {
    setFlashLoading(true)
    setMessage("")
    try {
      const res = await fetch("/api/ai/generate-flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, count: 10 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Generation failed")
      setMessage(`Created ${data.count} flashcards`)
      onSaved()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setFlashLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Topic content</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <textarea
          className="neo-inset min-h-[160px] w-full rounded-[var(--neo-radius)] bg-transparent px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Study notes, summaries, or pasted material…"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={saveContent}
            disabled={loading}
          >
            {loading ? "Saving…" : "Save content"}
          </Button>
          <Button
            variant="default"
            onClick={generateFlashcards}
            disabled={flashLoading || !content.trim()}
          >
            {flashLoading ? "Generating…" : "AI flashcards"}
          </Button>
        </div>
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </CardContent>
    </Card>
  )
}
