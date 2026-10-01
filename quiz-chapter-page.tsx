"use client"

import { useParams } from "next/navigation"
import { QuizRunner } from "@/components/quiz/quiz-runner"

export default function ChapterQuizPage() {
  const { chapterId, id: moduleId } = useParams<{ chapterId: string; id: string }>()

  return (
    <QuizRunner
      source={{ chapterId }}
      title="Chapter quiz"
      backHref={`/modules/${moduleId}/chapters/${chapterId}`}
      backLabel="Back to chapter"
    />
  )
}
