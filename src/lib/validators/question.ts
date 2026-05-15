import type { ExtractedQuestion } from "@/lib/ai/question-generator"

export function validateExtractedQuestions(
  questions: unknown
): questions is ExtractedQuestion[] {
  if (!Array.isArray(questions)) return false
  return questions.every(
    (q) =>
      q &&
      typeof q === "object" &&
      typeof (q as ExtractedQuestion).question === "string" &&
      Array.isArray((q as ExtractedQuestion).options) &&
      typeof (q as ExtractedQuestion).correctOption === "string"
  )
}
