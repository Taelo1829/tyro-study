"use client"

import { useState } from "react"
import { CheckCircle2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ExtractedQuestion } from "@/lib/ai/question-generator"

interface QuestionExtractorProps {
  topicId: string
  questions: ExtractedQuestion[]
  onChange: (questions: ExtractedQuestion[]) => void
  onSaved: () => void
}

export function QuestionExtractor({
  topicId,
  questions,
  onChange,
  onSaved,
}: QuestionExtractorProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  function remove(index: number) {
    onChange(questions.filter((_, i) => i !== index))
    setSaved(false)
  }

  async function saveAll() {
    setError("")
    setSaving(true)
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, questions }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Save failed")
      setSaved(true)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  if (questions.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          Extracted questions ({questions.length})
        </h3>
        <Button
          variant="primary"
          size="sm"
          disabled={saving || saved}
          onClick={saveAll}
        >
          {saved ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Saved
            </>
          ) : saving ? (
            "Saving…"
          ) : (
            "Save to topic"
          )}
        </Button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="space-y-3">
        {questions.map((q, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
              <CardTitle className="text-base font-medium">
                {i + 1}. {q.question}
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => remove(i)}
                aria-label="Remove question"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-1">
              {q.options.map((opt) => (
                <p
                  key={opt}
                  className={`text-sm ${
                    opt === q.correctOption
                      ? "font-medium text-accent"
                      : "text-muted-foreground"
                  }`}
                >
                  {opt === q.correctOption ? "✓ " : "○ "}
                  {opt}
                </p>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
