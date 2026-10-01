"use client"

import { useParams } from "next/navigation"
import { QuizRunner } from "@/components/quiz/quiz-runner"

export default function TopicQuizPage() {
    const { id: moduleId, topicId } = useParams<{ id: string; topicId: string }>()

    return (
        <QuizRunner
            source={{ topicId }}
            // "Back to Topic" used to link to /topics/<id>, a page that doesn't exist
            backHref={`/modules/${moduleId}/topics/${topicId}`}
            backLabel="Back to Topic"
        />
    )
}
