/**
 * Progress as steps (shared by the browser and the server):
 * - a chapter: each topic quiz passed is a step, and so is its chapter quiz;
 * - a module: all its chapters' steps, plus passing the mock exam.
 * Topics without quiz questions don't count.
 */

interface StatsLike {
  passed: number
}

export interface ChapterLike {
  topics: { questions: number; stats: StatsLike }[]
  pool: number
  stats: StatsLike
}

export interface ModuleLike {
  chapters: ChapterLike[]
  mock: { stats: StatsLike; plan: unknown | null }
}

export function chapterSteps(ch: ChapterLike) {
  const quizTopics = ch.topics.filter(t => t.questions > 0)
  const topicsPassed = quizTopics.filter(t => t.stats.passed > 0).length
  const hasChapterQuiz = ch.pool > 0
  const chapterPassed = hasChapterQuiz && ch.stats.passed > 0
  const total = quizTopics.length + (hasChapterQuiz ? 1 : 0)
  const done = topicsPassed + (chapterPassed ? 1 : 0)
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0, topicsPassed, topicCount: quizTopics.length, hasChapterQuiz, chapterPassed }
}

export function moduleSteps(mod: ModuleLike) {
  const chapters = mod.chapters.map(chapterSteps)
  const hasMock = !!mod.mock.plan
  const mockPassed = hasMock && mod.mock.stats.passed > 0
  const total = chapters.reduce((n, c) => n + c.total, 0) + (hasMock ? 1 : 0)
  const done = chapters.reduce((n, c) => n + c.done, 0) + (mockPassed ? 1 : 0)
  return {
    total,
    done,
    percent: total ? Math.round((done / total) * 100) : 0,
    topicsPassed: chapters.reduce((n, c) => n + c.topicsPassed, 0),
    topicCount: chapters.reduce((n, c) => n + c.topicCount, 0),
    chaptersPassed: chapters.filter(c => c.chapterPassed).length,
    chapterQuizzes: chapters.filter(c => c.hasChapterQuiz).length,
    hasMock,
    mockPassed,
  }
}
