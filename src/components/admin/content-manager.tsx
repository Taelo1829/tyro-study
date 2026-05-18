"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import NeumorphicEditor from "./rich-text-editor"
import { Modal, ModalFooter } from "./modal"

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
  const [toggle, setToggle] = useState(false)
  const [message, setMessage] = useState("")
  const [assignment, setAssignment] = useState("")

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

  async function addAssignmentToggle() {
    setToggle(!toggle)
  }

  async function saveAssignment() {
    try {
      setLoading(true)
      await fetch(`/api/topics/${topicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment }),
      })

      setLoading(false)
      addAssignmentToggle()
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Topic content</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <NeumorphicEditor
          value={content}
          setHtml={(e) => setContent(e)}
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
          <Button
            variant="default"
            onClick={addAssignmentToggle}
          >
            Add Assignment
          </Button>
        </div>
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </CardContent>
      <Modal open={toggle} onClose={addAssignmentToggle}>
        <Card>
          <CardHeader>
            <CardTitle>Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <NeumorphicEditor
              value={assignment}
              setHtml={(e) => setAssignment(e)}
            />
          </CardContent>

          <div className="py-4">
            <Button variant="default" className="float-end" onClick={saveAssignment}>Save Assignment</Button>
          </div>
        </Card>
      </Modal>
    </Card>
  )
}
