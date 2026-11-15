import { expect, it } from "vitest"
import { belongsToChapterQuiz, chapterQuizPoolSize } from "./chapter-quiz-pool"
import { ASSIGNMENT_CHECKPOINT, ASSIGNMENT_QUIZ } from "./module-recreation-input"

it("makes newly imported and existing topic-only chapters available for practice", () => {
  expect(chapterQuizPoolSize(0, [{ title: "Topic 1", questions: 10 }, { title: "Topic 2", questions: 10 }])).toBe(20)
  expect(chapterQuizPoolSize(5, [{ title: "Topic 1", questions: 10 }])).toBe(15)
})
it("does not mix standalone assignments into chapter practice", () => {
  expect(chapterQuizPoolSize(0, [{ title: ASSIGNMENT_QUIZ + "Quiz 1", questions: 20 }, { title: ASSIGNMENT_CHECKPOINT + "Task", questions: 1 }])).toBe(0)
})
it("keeps chapter scope for new and resumed quizzes", () => {
  expect(belongsToChapterQuiz({ chapterId: "ch", topicId: null, topic: null }, "ch")).toBe(true)
  expect(belongsToChapterQuiz({ chapterId: null, topicId: "topic", topic: { chapterId: "ch", title: "Lesson" } }, "ch")).toBe(true)
  expect(belongsToChapterQuiz({ chapterId: "ch", topicId: "topic", topic: { chapterId: "other", title: "Lesson" } }, "ch")).toBe(false)
  expect(belongsToChapterQuiz({ chapterId: "ch", topicId: "topic", topic: { chapterId: "ch", title: ASSIGNMENT_QUIZ + "Quiz" } }, "ch")).toBe(false)
})
