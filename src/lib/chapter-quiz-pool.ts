import { ASSIGNMENT_CHECKPOINT, ASSIGNMENT_QUIZ } from "./module-recreation-input"

/** Standalone assessments remain separate from chapter practice. */
export function isChapterPracticeTopic(topic: { title: string }) {
  return !topic.title.startsWith(ASSIGNMENT_CHECKPOINT) && !topic.title.startsWith(ASSIGNMENT_QUIZ)
}

export function chapterQuizQuestionWhere(chapterId: string) {
  return {
    OR: [
      { chapterId, topicId: null },
      { topic: { chapterId, NOT: [{ title: { startsWith: ASSIGNMENT_CHECKPOINT } }, { title: { startsWith: ASSIGNMENT_QUIZ } }] } },
    ],
  }
}

export function belongsToChapterQuiz(q: { chapterId: string | null; topicId: string | null; topic: { chapterId: string; title: string } | null }, chapterId: string) {
  return q.topicId === null ? q.chapterId === chapterId : !!q.topic && q.topic.chapterId === chapterId && isChapterPracticeTopic(q.topic)
}

export function chapterQuizPoolSize(dedicated: number, topics: { title: string; questions: number }[]) {
  return Math.max(0, dedicated) + topics.filter(isChapterPracticeTopic).reduce((total, topic) => total + Math.max(0, topic.questions), 0)
}
