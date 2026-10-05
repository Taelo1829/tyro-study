import { chatJson } from "@/lib/ai/openai"
import { UNISA_CONTEXT } from "@/lib/ai/unisa"
import { topicHeader } from "@/lib/ai/projects"
import { prisma } from "@/lib/prisma"
import { getTopicCoding } from "@/lib/coding"
import { CODING_LANGUAGES, type CodingLanguage } from "@/lib/coding-shared"
import { countBlanks } from "@/lib/code-blanks"
import { createExercise, listExercises, type ExerciseBlank } from "@/lib/exercises"
import { markBlankQuestion } from "@/lib/question-kinds"

/**
 * For coding modules, the AI writes:
 * - "Try it yourself" exercises for the lesson: a short program with blanks
 *   (____) the student fills in, checked instantly.
 * - Type-the-answer quiz questions: a snippet with one blank, answered by
 *   typing instead of picking an option.
 */

const PROMPT = `You are an experienced UNISA programming lecturer writing hands-on practice for one topic of a coding module.

${UNISA_CONTEXT}

Write two kinds of practice, both as code with blanks. A blank is written as exactly four underscores: ____

1. exercises ("Try it yourself", placed after the lesson):
- A short, complete, compilable-looking program or function (5 to 25 lines) that uses THIS topic's skill, in a realistic setting where it helps (student marks, a spaza shop, taxi fares, load-shedding stages).
- 1 to 3 blanks, each replacing a small piece the student must work out from the topic: a condition (x >= 50), an operator, a keyword (else, break), a loop bound, a function call, or the exact output of a line (put "// Output: ____" in a comment).
- A blank is never a whole line of logic and never something that can't be worked out from the instructions and the rest of the code.
- instructions: one or two sentences saying what the finished code must do, with any numbers the blanks depend on (e.g. "A mark of 50 or more is a pass").
- For each blank, list every answer that should count as right, written the way students would type them (e.g. ["mark >= 50", "50 <= mark"]). Spacing doesn't matter; the app ignores it.
- explanation: two or three sentences on why the answers are right.
- title: short (e.g. "Pass or fail").
- Vary them: easiest first.

2. questions (type-the-answer quiz questions):
- question: one sentence of what's asked, then a blank line, then a snippet of 1 to 8 lines with exactly ONE blank. E.g. "Fill in the condition so the loop prints 1 to 5:\\n\\nfor (int i = 1; ____; i++)\\n    cout << i << ' ';"
- The answer must be short (a few characters to one short expression) and exactly determined by the question.
- answers: every answer that should count as right.
- difficulty: "easy", "medium" or "hard".

Use the given programming language and its usual style. Indent code with spaces. Don't use the em dash.

Respond with JSON only: { "exercises": [ { "title": "…", "instructions": "…", "code": "…", "blanks": [ ["answer", "other accepted answer"] ], "explanation": "…" } ], "questions": [ { "question": "…", "answers": ["…"], "difficulty": "medium" } ] }`

interface Written {
  exercises: { title: string; instructions: string; code: string; blanks: ExerciseBlank[]; explanation: string | null }[]
  questions: { question: string; answers: string[]; difficulty: string }[]
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/—/g, ", ").replace(/\r\n/g, "\n").trim().slice(0, max) : "")
/** Accepted answers: strings, without duplicates or empties */
function answerList(v: unknown): string[] {
  const list = (Array.isArray(v) ? v : typeof v === "string" ? [v] : []).map(a => String(a).trim()).filter(Boolean)
  return [...new Set(list)].slice(0, 8)
}
/** Normalise any run of 4+ underscores the AI wrote to exactly ____ */
const tidyBlanks = (code: string) => code.replace(/(?<![A-Za-z0-9])_{4,}(?![A-Za-z0-9])/g, "____")

export async function writePractice(input: {
  header: string[]
  language: CodingLanguage
  lessonText: string
  exercises: number
  questions: number
  existing: string[]
}): Promise<Written> {
  const user = [
    ...input.header,
    `Programming language: ${CODING_LANGUAGES[input.language].label}`,
    input.lessonText ? `\nThe topic's lesson:\n${input.lessonText.slice(0, 16_000)}` : "",
    input.existing.length ? `\nExisting exercises (write different ones):\n${input.existing.map(t => `- ${t}`).join("\n")}` : "",
    `\nWrite ${input.exercises} exercise${input.exercises === 1 ? "" : "s"} and ${input.questions} question${input.questions === 1 ? "" : "s"}.`,
  ].join("\n")

  const parsed = await chatJson<{ exercises?: unknown; questions?: unknown }>({ system: PROMPT, user, temperature: 0.5, maxTokens: 8000 })

  const seen = new Set(input.existing.map(t => t.toLowerCase()))
  const exercises: Written["exercises"] = []
  for (const e of (Array.isArray(parsed.exercises) ? parsed.exercises : []) as Record<string, unknown>[]) {
    const title = clean(e?.title, 120)
    const code = tidyBlanks(clean(e?.code, 4000))
    const blanks = (Array.isArray(e?.blanks) ? e.blanks : []).map(b => ({ answers: answerList(Array.isArray(b) ? b : (b as { answers?: unknown })?.answers ?? b) }))
    // The code's blanks and the answers must line up, every blank needs an answer
    if (!title || !code || seen.has(title.toLowerCase())) continue
    if (blanks.length === 0 || countBlanks(code) !== blanks.length || blanks.some(b => b.answers.length === 0)) continue
    seen.add(title.toLowerCase())
    exercises.push({ title, code, blanks, instructions: clean(e.instructions, 800), explanation: clean(e.explanation, 1200) || null })
  }

  const questions: Written["questions"] = []
  for (const q of (Array.isArray(parsed.questions) ? parsed.questions : []) as Record<string, unknown>[]) {
    const question = tidyBlanks(clean(q?.question, 3000))
    const answers = answerList(q?.answers)
    if (!question || countBlanks(question) !== 1 || answers.length === 0) continue
    questions.push({ question, answers, difficulty: q.difficulty === "easy" || q.difficulty === "hard" ? q.difficulty : "medium" })
  }
  return { exercises: exercises.slice(0, input.exercises), questions: questions.slice(0, input.questions) }
}

/**
 * Write and save "Try it yourself" exercises and type-the-answer quiz
 * questions for a topic in a coding module. Returns how many of each were added.
 */
export async function generateTopicPractice(topicId: string, counts: { exercises: number; questions: number }) {
  const coding = await getTopicCoding(topicId)
  if (!coding?.language) throw new Error("This topic isn't in a coding module. Switch the module to a coding module first.")
  if (counts.exercises + counts.questions === 0) return { exercises: 0, questions: 0 }
  const info = await topicHeader(topicId)
  if (!info) throw new Error("Topic not found")
  const existing = await listExercises(topicId)
  const written = await writePractice({
    header: info.header,
    language: coding.language,
    lessonText: info.lessonText,
    exercises: counts.exercises,
    questions: counts.questions,
    existing: existing.map(e => e.title),
  })

  let exercises = 0
  for (const e of written.exercises) {
    await createExercise(topicId, { ...e, language: coding.language })
    exercises++
  }

  let questions = 0
  const have = new Set(
    (await prisma.question.findMany({ where: { topicId }, select: { question: true } })).map(q => q.question.trim().toLowerCase())
  )
  for (const q of written.questions) {
    if (have.has(q.question.toLowerCase())) continue
    const created = await prisma.question.create({
      data: {
        topicId,
        question: q.question,
        difficulty: q.difficulty,
        answers: { create: q.answers.map(answer => ({ answer, isCorrect: true })) },
      },
      select: { id: true },
    })
    try {
      await markBlankQuestion(created.id)
    } catch (err) {
      // Without the migration it would be a multiple-choice question where every option is right
      await prisma.question.delete({ where: { id: created.id } })
      throw new Error("Type-the-answer questions need the latest database update: run `npx prisma migrate deploy`.", { cause: err })
    }
    questions++
  }
  return { exercises, questions }
}
