"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import NeumorphicEditor from "./rich-text-editor"
import { Modal, ModalBody, ModalFooter, ModalHeader } from "./modal"
import { Sparkles, MonitorPlay } from "lucide-react"
import { getVideoEmbedHtml, sanitizeTopicHtml } from "@/lib/topic-content"
import { VideoFinder } from "./video-finder"
import { cn } from "@/lib/utils"

type LessonLength = "short" | "standard" | "detailed"

const LENGTHS: { id: LessonLength; label: string; hint: string }[] = [
  { id: "short", label: "Short", hint: "~500 words" },
  { id: "standard", label: "Standard", hint: "~1,100 words" },
  { id: "detailed", label: "Detailed", hint: "~2,000 words" },
]

interface ContentManagerProps {
  topicId: string
  initialContent: string
  initialAssignment?: string
  onSaved: () => void
}

export function ContentManager({
  topicId,
  initialContent,
  initialAssignment = "",
  onSaved,
}: ContentManagerProps) {
  const [content, setContent] = useState(initialContent)
  const [loading, setLoading] = useState(false)
  const [toggle, setToggle] = useState(false)
  const [message, setMessage] = useState("")
  const [assignment, setAssignment] = useState(initialAssignment)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiLength, setAiLength] = useState<LessonLength>("standard")
  const [aiNotes, setAiNotes] = useState("")
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState("")
  const [videoOpen, setVideoOpen] = useState(false)

  const hasContent = content.replace(/<[^>]+>/g, "").trim().length > 0

  async function writeWithAi() {
    if (hasContent && !confirm("Replace the current lesson with the AI draft? (Nothing is saved until you press Save lesson.)")) return
    setAiBusy(true)
    setAiError("")
    try {
      const res = await fetch("/api/ai/generate-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, length: aiLength, notes: aiNotes }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "The AI couldn't write this lesson")
      const draft = sanitizeTopicHtml(data.html ?? "")
      if (!draft) throw new Error("The AI didn't return any lesson content")
      setContent(draft)
      setAiOpen(false)
      setMessage(
        `AI draft added${data.usedPdfs ? ` (based on ${data.usedPdfs} PDF${data.usedPdfs > 1 ? "s" : ""})` : ""}. Check it over, edit anything you like, then press Save lesson.`
      )
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "The AI couldn't write this lesson")
    } finally {
      setAiBusy(false)
    }
  }

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

  /** Add a video to the end of the lesson and save the lesson (with any unsaved edits) */
  async function addVideo(url: string) {
    const embed = getVideoEmbedHtml(url)
    if (!embed) throw new Error("That video link can't be embedded")
    const next = `${content}${embed}`
    const res = await fetch(`/api/topics/${topicId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: next }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? "Couldn't save the lesson")
    }
    setContent(next)
    setMessage("Video added to the end of the lesson and saved. Students see it in the Video tab.")
    onSaved()
  }

  async function addAssignmentToggle() {
    setToggle(!toggle)
  }

  async function saveAssignment() {
    setLoading(true)
    setMessage("")
    try {
      const res = await fetch(`/api/topics/${topicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Saving the assignment failed")
      }
      setMessage("Assignment saved")
      setToggle(false)
      onSaved()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Saving the assignment failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lesson</CardTitle>
        <p className="text-sm text-muted-foreground">Write the lesson students read before the PDFs. Use Preview to see it exactly as they will.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <NeumorphicEditor
          value={content}
          setHtml={(e) => setContent(e)}
          placeholder="Start writing the lesson… (headings, lists, images, key-idea boxes, videos)"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={saveContent}
            disabled={loading}
          >
            {loading ? "Saving…" : "Save lesson"}
          </Button>
          <Button
            variant="default"
            onClick={() => { setAiError(""); setAiOpen(true) }}
          >
            <Sparkles className="h-4 w-4" />
            Write with AI
          </Button>
          <Button variant="default" onClick={() => setVideoOpen(true)}>
            <MonitorPlay className="h-4 w-4" />
            Find video with AI
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
      <Modal open={aiOpen} onClose={() => !aiBusy && setAiOpen(false)} size="md">
        <ModalHeader onClose={() => !aiBusy && setAiOpen(false)}>Write this lesson with AI</ModalHeader>
        <ModalBody className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The AI reads this topic&apos;s module, chapter and topic (plus its quiz questions and any PDFs you&apos;ve uploaded)
            and drafts a lesson for UNISA students. You can review and edit it before saving.
          </p>

          <div>
            <p className="mb-2 text-sm font-medium">Length</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Lesson length">
              {LENGTHS.map(l => (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={aiLength === l.id}
                  disabled={aiBusy}
                  onClick={() => setAiLength(l.id)}
                  className={cn(
                    "rounded-2xl px-3 py-2.5 text-center transition-colors",
                    aiLength === l.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-muted/70"
                  )}
                >
                  <span className="block text-sm font-semibold">{l.label}</span>
                  <span className={cn("block text-xs", aiLength === l.id ? "text-primary-foreground/80" : "text-muted-foreground")}>{l.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="ai-notes" className="mb-2 block text-sm font-medium">
              Anything to focus on? <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="ai-notes"
              value={aiNotes}
              onChange={e => setAiNotes(e.target.value)}
              disabled={aiBusy}
              rows={3}
              maxLength={2000}
              placeholder="e.g. Use more worked examples on nested loops; this was a weak area in last year's exam."
              className="neo-inset w-full resize-y rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          {aiBusy && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              Writing the lesson… this can take up to a minute.
            </p>
          )}
          {aiError && <p className="text-sm text-red-600" role="alert">{aiError}</p>}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setAiOpen(false)} disabled={aiBusy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={writeWithAi} disabled={aiBusy}>
            <Sparkles className="h-4 w-4" />
            {aiBusy ? "Writing…" : hasContent ? "Write & replace" : "Write lesson"}
          </Button>
        </ModalFooter>
      </Modal>

      {videoOpen && <VideoFinder topicId={topicId} onClose={() => setVideoOpen(false)} onAdd={addVideo} />}

      <Modal open={toggle} onClose={addAssignmentToggle}>
        <Card>
          <CardHeader>
            <CardTitle>Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <NeumorphicEditor
              value={assignment}
              setHtml={(e) => setAssignment(e)}
              placeholder="Describe the assignment…"
            />
          </CardContent>

          <div className="py-4">
            <Button variant="default" className="float-end" onClick={saveAssignment} disabled={loading}>{loading ? "Saving…" : "Save Assignment"}</Button>
          </div>
        </Card>
      </Modal>
    </Card>
  )
}
