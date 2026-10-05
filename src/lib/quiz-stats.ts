import { prisma } from "@/lib/prisma"

/**
 * Quiz tracking for a student in a module: every topic quiz, chapter quiz and
 * the mock exam (module quiz) - attempts, passes, fails, best/last score and
 * time taken - plus the chapter quiz time estimates and the mock exam plan.
 *
 * Time estimates come from the student's own pace (seconds per question):
 * on that chapter's quizzes, else across the module, else everyone's pace in
 * the module, else DEFAULT_SECONDS_PER_QUESTION.
 */

export const TOPIC_QUIZ_SIZE = 20
export const CHAPTER_QUIZ_SIZE = 20
export const DEFAULT_SECONDS_PER_QUESTION = 60
export const MOCK_EXAM_MAX_SECONDS = 3 * 60 * 60
export const MOCK_EXAM_PASS_MARK = 50
const DEFAULT_PASS_MARK = 70
/** A quiz left open for ages says nothing about pace: count at most this per question */
const MAX_SECONDS_PER_QUESTION = 5 * 60

export interface QuizStats {
  attempts: number
  passed: number
  failed: number
  best: number | null
  last: { score: number; seconds: number; at: Date } | null
  averageSeconds: number | null
  fastestPassSeconds: number | null
}

export interface TopicProgress {
  id: string
  title: string
  questions: number
  stats: QuizStats
}

export interface ChapterProgress {
  id: string
  title: string
  topics: TopicProgress[]
  /** Questions a chapter quiz can draw from (topics' + the chapter's own) */
  pool: number
  quizSize: number
  stats: QuizStats
  estimateSeconds: number
}

export interface MockExamPlan {
  /** Questions per chapter, in chapter order */
  perChapter: { chapterId: string; questions: number; seconds: number }[]
  totalQuestions: number
  timeLimitSeconds: number
  /** True when the 3 hour cap made the exam shorter than all chapter quizzes together */
  capped: boolean
}

export interface ModuleProgress {
  moduleId: string
  title: string
  chapters: ChapterProgress[]
  mock: { stats: QuizStats; plan: MockExamPlan | null; passMark: number }
  summary: {
    topicsWithQuiz: number
    topicsPassed: number
    chaptersWithQuiz: number
    chaptersPassed: number
    quizzesTaken: number
    quizzesFailed: number
    totalSeconds: number
    secondsPerQuestion: number
  }
}

interface AttemptRow {
  topicId: string | null
  moduleId: string | null
  settings: string
  score: number | null
  totalQuestions: number
  startedAt: Date
  completedAt: Date | null
}

type Kind = { type: "topic" | "chapter" | "module"; id: string }

function kindOf(a: AttemptRow): { kind: Kind | null; passMark: number } {
  let settings: { source?: string; passingScore?: number } = {}
  try {
    settings = JSON.parse(a.settings)
  } catch {}
  const passMark = typeof settings.passingScore === "number" ? settings.passingScore : DEFAULT_PASS_MARK
  const [type, id] = (settings.source ?? "").split(":")
  if ((type === "topic" || type === "chapter" || type === "module") && id) return { kind: { type, id }, passMark }
  // Older attempts (before the source was saved)
  if (a.topicId) return { kind: { type: "topic", id: a.topicId }, passMark }
  if (a.moduleId) return { kind: { type: "module", id: a.moduleId }, passMark }
  return { kind: null, passMark }
}

/** Time taken; a timed exam counts at most its time limit (handed in late after leaving the page) */
function seconds(a: AttemptRow): number {
  if (!a.completedAt) return 0
  const taken = Math.max(0, Math.round((a.completedAt.getTime() - a.startedAt.getTime()) / 1000))
  try {
    const limit = Number(JSON.parse(a.settings).timeLimit)
    return limit > 0 ? Math.min(taken, Math.round(limit * 60)) : taken
  } catch {
    return taken
  }
}

function statsOf(list: { score: number; seconds: number; at: Date; passMark: number }[]): QuizStats {
  if (list.length === 0) return { attempts: 0, passed: 0, failed: 0, best: null, last: null, averageSeconds: null, fastestPassSeconds: null }
  const sorted = [...list].sort((a, b) => b.at.getTime() - a.at.getTime())
  const passes = list.filter(a => a.score >= a.passMark)
  return {
    attempts: list.length,
    passed: passes.length,
    failed: list.length - passes.length,
    best: Math.max(...list.map(a => a.score)),
    last: { score: sorted[0].score, seconds: sorted[0].seconds, at: sorted[0].at },
    averageSeconds: Math.round(list.reduce((n, a) => n + a.seconds, 0) / list.length),
    fastestPassSeconds: passes.length ? Math.min(...passes.map(a => a.seconds)) : null,
  }
}

/** Seconds per question over some attempts, ignoring time left idle; null with no data */
function paceOf(list: { seconds: number; questions: number }[]): number | null {
  // Under 5 seconds a question means the quiz was ended rather than done: it says nothing about pace
  const usable = list.filter(a => a.questions > 0 && a.seconds >= a.questions * 5)
  if (usable.length === 0) return null
  const secs = usable.reduce((n, a) => n + Math.min(a.seconds, a.questions * MAX_SECONDS_PER_QUESTION), 0)
  const qs = usable.reduce((n, a) => n + a.questions, 0)
  return Math.max(10, Math.round(secs / qs))
}

/** Everyone's pace on this module's quizzes (fallback when a student has no history) */
async function modulePaceForEveryone(topicIds: string[], moduleId: string): Promise<number | null> {
  const rows = await prisma.quizAttempt.findMany({
    where: { status: "COMPLETED", OR: [{ topicId: { in: topicIds } }, { moduleId }] },
    select: { startedAt: true, completedAt: true, totalQuestions: true },
    orderBy: { completedAt: "desc" },
    take: 500,
  })
  return paceOf(rows.map(r => ({ seconds: r.completedAt ? (r.completedAt.getTime() - r.startedAt.getTime()) / 1000 : 0, questions: r.totalQuestions })))
}

export async function moduleProgress(userId: string, moduleId: string): Promise<ModuleProgress | null> {
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: {
      id: true,
      title: true,
      chapters: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          _count: { select: { questions: true } },
          topics: { orderBy: { order: "asc" }, select: { id: true, title: true, _count: { select: { questions: true } } } },
        },
      },
    },
  })
  if (!mod) return null

  const topicIds = mod.chapters.flatMap(c => c.topics.map(t => t.id))
  const chapterIds = mod.chapters.map(c => c.id)
  const raw = await prisma.quizAttempt.findMany({
    where: {
      userId,
      status: "COMPLETED",
      OR: [
        { topicId: { in: topicIds } },
        { moduleId },
        ...chapterIds.map(id => ({ settings: { contains: `"source":"chapter:${id}"` } })),
      ],
    },
    select: { topicId: true, moduleId: true, settings: true, score: true, totalQuestions: true, startedAt: true, completedAt: true },
  })

  type Item = { score: number; seconds: number; at: Date; passMark: number; questions: number }
  const byKey = new Map<string, Item[]>()
  for (const a of raw) {
    const { kind, passMark } = kindOf(a)
    if (!kind || !a.completedAt) continue
    const key = `${kind.type}:${kind.id}`
    byKey.set(key, [...(byKey.get(key) ?? []), { score: a.score ?? 0, seconds: seconds(a), at: a.completedAt, passMark, questions: a.totalQuestions }])
  }
  const items = (key: string) => byKey.get(key) ?? []

  // Pace: this student across the module, else everyone, else the default
  const mine = [...byKey.entries()].filter(([k]) => !k.startsWith("module:")).flatMap(([, v]) => v)
  const modulePace = paceOf(mine) ?? (await modulePaceForEveryone(topicIds, moduleId)) ?? DEFAULT_SECONDS_PER_QUESTION

  const chapters: ChapterProgress[] = mod.chapters.map(ch => {
    const topics = ch.topics.map(t => ({ id: t.id, title: t.title, questions: t._count.questions, stats: statsOf(items(`topic:${t.id}`)) }))
    const pool = ch._count.questions + ch.topics.reduce((n, t) => n + t._count.questions, 0)
    const quizSize = Math.min(CHAPTER_QUIZ_SIZE, pool)
    // The chapter's own pace: its chapter quizzes, else its topic quizzes, else the module's
    const chapterPace =
      paceOf(items(`chapter:${ch.id}`)) ?? paceOf(ch.topics.flatMap(t => items(`topic:${t.id}`))) ?? modulePace
    return {
      id: ch.id,
      title: ch.title,
      topics,
      pool,
      quizSize,
      stats: statsOf(items(`chapter:${ch.id}`)),
      estimateSeconds: Math.ceil((quizSize * chapterPace) / 60) * 60,
    }
  })

  const plan = mockExamPlan(chapters)
  const all = [...byKey.values()].flat()
  const topicsWithQuiz = chapters.flatMap(c => c.topics).filter(t => t.questions > 0)
  const passedTopic = (t: TopicProgress) => t.stats.passed > 0
  return {
    moduleId: mod.id,
    title: mod.title,
    chapters,
    mock: { stats: statsOf(items(`module:${mod.id}`)), plan, passMark: MOCK_EXAM_PASS_MARK },
    summary: {
      topicsWithQuiz: topicsWithQuiz.length,
      topicsPassed: topicsWithQuiz.filter(passedTopic).length,
      chaptersWithQuiz: chapters.filter(c => c.pool > 0).length,
      chaptersPassed: chapters.filter(c => c.pool > 0 && c.stats.passed > 0).length,
      quizzesTaken: all.length,
      quizzesFailed: all.filter(a => a.score < a.passMark).length,
      totalSeconds: all.reduce((n, a) => n + a.seconds, 0),
      secondsPerQuestion: modulePace,
    },
  }
}

/**
 * The mock exam: each chapter gets its chapter quiz's number of questions and
 * its chapter quiz time. If that adds up to more than 3 hours, every chapter's
 * share shrinks by the same factor so the exam fits in 3 hours.
 */
export function mockExamPlan(chapters: Pick<ChapterProgress, "id" | "quizSize" | "estimateSeconds">[]): MockExamPlan | null {
  const parts = chapters.filter(c => c.quizSize > 0).map(c => ({ chapterId: c.id, questions: c.quizSize, pace: c.estimateSeconds / c.quizSize }))
  if (parts.length === 0) return null
  const fullSeconds = parts.reduce((n, p) => n + p.questions * p.pace, 0)
  const capped = fullSeconds > MOCK_EXAM_MAX_SECONDS
  const factor = capped ? MOCK_EXAM_MAX_SECONDS / fullSeconds : 1
  const perChapter = parts.map(p => {
    const questions = Math.max(1, Math.floor(p.questions * factor))
    return { chapterId: p.chapterId, questions, seconds: Math.round(questions * p.pace) }
  })
  const total = perChapter.reduce((n, p) => n + p.seconds, 0)
  // Whole 5 minutes, at least 10 minutes, at most 3 hours
  const timeLimitSeconds = Math.min(MOCK_EXAM_MAX_SECONDS, Math.max(600, Math.ceil(total / 300) * 300))
  return { perChapter, totalQuestions: perChapter.reduce((n, p) => n + p.questions, 0), timeLimitSeconds, capped }
}

/** The chapter quiz's estimated time for a student (seconds) */
export async function chapterEstimate(userId: string, chapterId: string): Promise<number | null> {
  const ch = await prisma.chapter.findUnique({ where: { id: chapterId }, select: { moduleId: true } })
  if (!ch) return null
  const progress = await moduleProgress(userId, ch.moduleId)
  return progress?.chapters.find(c => c.id === chapterId)?.estimateSeconds ?? null
}
