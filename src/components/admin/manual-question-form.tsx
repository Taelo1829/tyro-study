"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface ManualQuestionFormProps {
  topicId?: string
  chapterId?: string
  onSaved: () => void
}

const DIFFICULTIES = ["easy", "medium", "hard"] as const

const EMPTY = {
  question: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  difficulty: "medium" as (typeof DIFFICULTIES)[number],
}

export function ManualQuestionForm({
  topicId,
  chapterId,
  onSaved,
}: ManualQuestionFormProps) {
  const [question, setQuestion] = useState(EMPTY.question)
  const [options, setOptions] = useState<string[]>(EMPTY.options)
  const [correctIndex, setCorrectIndex] = useState(EMPTY.correctIndex)
  const [difficulty, setDifficulty] = useState(EMPTY.difficulty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function reset() {
    setQuestion(EMPTY.question)
    setOptions(EMPTY.options)
    setCorrectIndex(EMPTY.correctIndex)
    setDifficulty(EMPTY.difficulty)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!question.trim()) {
      setError("Question text is required")
      return
    }
    const filled = options.map((o) => o.trim()).filter(Boolean)
    if (filled.length < 2) {
      setError("Provide at least two options")
      return
    }
    if (!options[correctIndex]?.trim()) {
      setError("The marked correct answer must not be empty")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(topicId ? { topicId } : {}),
          ...(chapterId ? { chapterId } : {}),
          difficulty,
          questions: [
            {
              question: question.trim(),
              options: filled,
              correctOption: options[correctIndex].trim(),
            },
          ],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Save failed")
      reset()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium">Question</label>
        <Input
          placeholder="Enter the question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Options</label>
        <p className="text-xs text-muted-foreground">
          Select the radio next to the correct answer.
        </p>
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct-option"
              aria-label={`Mark option ${i + 1} as correct`}
              checked={correctIndex === i}
              onChange={() => setCorrectIndex(i)}
              className="h-4 w-4 shrink-0 accent-primary"
            />
            <Input
              placeholder={`Option ${i + 1}`}
              value={opt}
              onChange={(e) =>
                setOptions((prev) =>
                  prev.map((o, idx) => (idx === i ? e.target.value : o))
                )
              }
            />
            {options.length > 2 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 px-2 text-muted-foreground"
                aria-label={`Remove option ${i + 1}`}
                onClick={() => {
                  setOptions((prev) => prev.filter((_, idx) => idx !== i))
                  if (correctIndex >= i && correctIndex > 0) {
                    setCorrectIndex((c) => c - 1)
                  }
                }}
              >
                ✕
              </Button>
            )}
          </div>
        ))}
        {options.length < 6 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOptions((prev) => [...prev, ""])}
          >
            <Plus className="h-4 w-4" />
            Add option
          </Button>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Difficulty</label>
        <select
          value={difficulty}
          onChange={(e) =>
            setDifficulty(e.target.value as (typeof DIFFICULTIES)[number])
          }
          className="neo-inset h-10 w-full rounded-[var(--neo-radius)] bg-transparent px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d} className="capitalize">
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button type="submit" variant="primary" disabled={loading}>
        {loading ? "Saving…" : "Add question"}
      </Button>
    </form>
  )
}
