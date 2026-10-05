import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { moduleLines } from "@/lib/ai/unisa"
import { htmlToText } from "@/lib/ai/unisa"
import { isTextbookBlobUrl, loadTextbookPages, pagesText } from "@/lib/ai/textbook"
import { lessonVideoIds, suggestTopicVideo } from "@/lib/ai/videos"
import { getVideoEmbedHtml } from "@/lib/topic-content"
import { getTopicCoding, countProjects } from "@/lib/coding"
import { generateTopicProjects } from "@/lib/ai/projects"
import { generateTopicPractice } from "@/lib/ai/exercises"
import { countExercises } from "@/lib/exercises"
import { DIFFICULTY_GUIDE, LENGTH_GUIDE, type Length, writeFlashcards, writeLessonHtml, writeQuestions } from "@/lib/ai/writers"

/**
 * POST { topicId, pagesUrl?, startPage?, endPage?, length?, questionCount?, video?, flashcards? }
 *
 * Writes one topic's lesson and quiz and saves them: from its textbook pages
 * (textbook import), or without pagesUrl from what the UNISA module normally
 * covers (course import). In a coding module it also writes `projects`
 * coding projects (default 2) unless the topic has some already, and (unless it has
 * some already) "Try it yourself" exercises plus type-the-answer quiz questions. With video: true it also finds a YouTube video for
 * the topic and adds it to the lesson; with flashcards: n it writes n revision
 * flashcards. Safe to retry: a topic that already has a lesson keeps it,
 * questions are only added up to questionCount, a lesson that already has a
 * video doesn't get another, and a topic with flashcards doesn't get more.
 */

export const runtime = "nodejs"
export const maxDuration = 300

const SOURCE_LIMIT = 40_000
const QUESTION_COUNTS = [0, 5, 10, 15, 20] as const

export async function POST(request: Request) {
  try {
    const { error } = await requireAdmin()
    if (error) return error

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const fromTextbook = body.pagesUrl !== undefined && body.pagesUrl !== null
    if (typeof body.topicId !== "string" || (fromTextbook && !isTextbookBlobUrl(body.pagesUrl))) {
      return NextResponse.json({ error: "topicId is required, and pagesUrl must be an uploaded textbook" }, { status: 400 })
    }
    const flashcardCount = Math.max(0, Math.min(20, Math.floor(Number(body.flashcards) || 0)))
    const projectCount = body.projects === undefined ? 2 : Math.max(0, Math.min(5, Math.floor(Number(body.projects) || 0)))
    const length: Length = typeof body.length === "string" && body.length in LENGTH_GUIDE ? (body.length as Length) : "standard"
    const questionCount = QUESTION_COUNTS.includes(Number(body.questionCount) as (typeof QUESTION_COUNTS)[number])
      ? Number(body.questionCount)
      : 20

    const topic = await prisma.topic.findUnique({
      where: { id: body.topicId },
      select: {
        id: true,
        title: true,
        content: true,
        questions: { select: { question: true } },
        _count: { select: { flashcards: true } },
        chapter: {
          select: {
            id: true,
            title: true,
            topics: { orderBy: { order: "asc" }, select: { id: true, title: true } },
            module: {
              select: { title: true, description: true, chapters: { orderBy: { order: "asc" }, select: { id: true } } },
            },
          },
        },
      },
    })
    if (!topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 })

    const source = fromTextbook
      ? pagesText(await loadTextbookPages(body.pagesUrl as string), Number(body.startPage), Number(body.endPage), SOURCE_LIMIT)
      : ""

    const mod = topic.chapter.module
    const chapterNo = mod.chapters.findIndex(c => c.id === topic.chapter.id) + 1
    const topicNo = topic.chapter.topics.findIndex(t => t.id === topic.id) + 1
    const header = [
      ...moduleLines(mod),
      `Chapter ${chapterNo}: ${topic.chapter.title}`,
      `Topic ${chapterNo}.${topicNo}: ${topic.title}`,
    ]

    // ---- lesson
    let lesson = topic.content ?? ""
    let wroteLesson = false
    if (!htmlToText(lesson)) {
      const prompt = [
        ...header,
        "",
        "Topics in this chapter (teach only THIS topic; you may briefly refer to the others but don't teach them):",
        topic.chapter.topics.map((t, i) => `${chapterNo}.${i + 1} ${t.title}${t.id === topic.id ? "  ← THIS TOPIC" : ""}`).join("\n"),
        source
          ? `\nThe prescribed textbook's pages for this topic (base the lesson on them; they take priority over general knowledge). Explain in your own words: don't copy long passages, and keep the book's notation and terms:\n${source}`
          : fromTextbook
            ? "\nNo textbook pages were found for this topic. Use standard content for this UNISA module at this level."
            : "\nNo textbook is attached. Teach what this UNISA module normally covers for this topic, at this year level, using standard, widely accepted content.",
        "",
        `Length: ${LENGTH_GUIDE[length]}.`,
      ].join("\n")
      lesson = await writeLessonHtml(prompt)
      await prisma.topic.update({ where: { id: topic.id }, data: { content: lesson } })
      wroteLesson = true
    }

    // ---- quiz
    const needed = Math.max(0, questionCount - topic.questions.length)
    let added = 0
    if (needed > 0) {
      const existing = topic.questions.map(q => q.question)
      const lessonText = htmlToText(lesson)
      const material = [lessonText && `Lesson:\n${lessonText}`, source && `Textbook pages:\n${source}`]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 45_000)
      const prompt = [
        ...header,
        "Ask only about THIS topic.",
        "",
        `Write ${needed} multiple-choice questions for the topic quiz for topic ${chapterNo}.${topicNo}.`,
        `Difficulty: ${DIFFICULTY_GUIDE.mixed}.`,
        `\nBase the questions on this material (it takes priority over general knowledge):\n${material}`,
        existing.length ? `\nExisting questions (do NOT repeat or closely rephrase these):\n${existing.map(q => `- ${q}`).join("\n")}` : "",
      ].join("\n")
      const questions = (await writeQuestions(prompt, existing, "mixed")).slice(0, needed)
      // One question at a time (each with its answers): a single transaction for
      // all of them can time out on a pooled/serverless database. A retry only
      // adds the questions still missing, so a partial save is fine.
      for (const q of questions) {
        await prisma.question.create({
          data: {
            topicId: topic.id,
            question: q.question,
            difficulty: q.difficulty,
            answers: { create: q.options.map(answer => ({ answer, isCorrect: answer === q.correctOption })) },
          },
        })
      }
      added = questions.length
    }

    // ---- flashcards (optional, for theory topics). Like the video, a problem here doesn't fail the topic.
    let flashcardsAdded = 0
    let flashcardNote: string | null = null
    if (flashcardCount > 0 && topic._count.flashcards === 0 && htmlToText(lesson)) {
      try {
        const cards = await writeFlashcards(
          [...header, "", `Lesson for this topic:\n${htmlToText(lesson).slice(0, 30_000)}`].join("\n"),
          flashcardCount
        )
        if (cards.length) {
          flashcardsAdded = (await prisma.flashcard.createMany({ data: cards.map(c => ({ topicId: topic.id, ...c })) })).count
        }
      } catch (err) {
        flashcardNote = err instanceof Error ? err.message : "flashcards failed"
      }
    }

    // ---- coding projects (coding modules only). A problem here doesn't fail the topic.
    let projectsAdded = 0
    let projectNote: string | null = null
    if (projectCount > 0 && htmlToText(lesson)) {
      try {
        const coding = await getTopicCoding(topic.id)
        if (coding?.language && (await countProjects(topic.id)) === 0) {
          projectsAdded = await generateTopicProjects(topic.id, projectCount)
        }
      } catch (err) {
        projectNote = err instanceof Error ? err.message : "projects failed"
      }
    }

    // ---- "Try it yourself" exercises and type-the-answer questions (coding modules only)
    let exercisesAdded = 0
    let typedQuestionsAdded = 0
    let exerciseNote: string | null = null
    if (body.exercises !== false && htmlToText(lesson)) {
      try {
        const coding = await getTopicCoding(topic.id)
        if (coding?.language && (await countExercises(topic.id)) === 0) {
          const practice = await generateTopicPractice(topic.id, { exercises: 2, questions: 5 })
          exercisesAdded = practice.exercises
          typedQuestionsAdded = practice.questions
        }
      } catch (err) {
        exerciseNote = err instanceof Error ? err.message : "exercises failed"
      }
    }

    // ---- video (optional). A problem here doesn't fail the topic: the lesson and quiz are saved.
    let videoTitle: string | null = null
    let videoNote: string | null = null
    if (body.video === true && htmlToText(lesson) && lessonVideoIds(lesson).length === 0) {
      try {
        const found = await suggestTopicVideo(topic.id)
        const embed = found.video ? getVideoEmbedHtml(found.video.url) : null
        if (found.video && embed) {
          lesson = `${lesson}\n${embed}`
          await prisma.topic.update({ where: { id: topic.id }, data: { content: lesson } })
          videoTitle = found.video.title
        } else {
          videoNote = "no good video found"
        }
      } catch (err) {
        videoNote = err instanceof Error ? err.message : "video search failed"
      }
    }

    return NextResponse.json({ wroteLesson, questionsAdded: added, hadSource: !!source, videoTitle, videoNote, flashcardsAdded, flashcardNote, projectsAdded, projectNote, exercisesAdded, typedQuestionsAdded, exerciseNote })
  } catch (err) {
    console.error("Textbook topic error:", err)
    const message = err instanceof Error ? err.message : "Couldn't write this topic"
    return NextResponse.json({ error: message }, { status: message.includes("OPENAI_API_KEY") ? 503 : 500 })
  }
}
