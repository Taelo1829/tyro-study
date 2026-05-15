import { getOpenAIClient } from "./openai"

export interface ExtractedQuestion {
  question: string
  options: string[]
  correctOption: string
}

export interface ExtractionResult {
  questions: ExtractedQuestion[]
}

const SYSTEM_PROMPT = `You are an expert educator. Extract multiple-choice questions from study material.
Return valid JSON only, matching this schema:
{
  "questions": [
    {
      "question": "string",
      "options": ["option A", "option B", "option C", "option D"],
      "correctOption": "exact text of the correct option from the options array"
    }
  ]
}
Rules:
- Extract or generate 5-15 high-quality questions from the content.
- Each question must have 3-5 options.
- correctOption must exactly match one entry in options.
- If the source has explicit MCQs, extract them faithfully.
- Otherwise generate questions that test key concepts.`

export async function extractQuestionsFromText(
  text: string
): Promise<ExtractionResult> {
  const openai = getOpenAIClient()

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Extract multiple-choice questions from this study material:\n\n${text}`,
      },
    ],
  })

  const raw = response.choices[0]?.message?.content
  if (!raw) {
    throw new Error("No response from AI")
  }

  const parsed = JSON.parse(raw) as ExtractionResult
  if (!Array.isArray(parsed.questions)) {
    throw new Error("Invalid AI response format")
  }

  const questions = parsed.questions
    .filter(
      (q) =>
        q.question &&
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        q.correctOption
    )
    .map((q) => ({
      question: q.question.trim(),
      options: q.options.map((o) => String(o).trim()).filter(Boolean),
      correctOption: q.correctOption.trim(),
    }))
    .filter((q) => q.options.includes(q.correctOption))

  if (questions.length === 0) {
    throw new Error("AI did not return valid questions")
  }

  return { questions }
}
