export interface RubricItem { criterion: string; marks: number }
export interface WrittenFeedback {
  earnedMarks: number; maxMarks: number; summary: string; transcription: string; modelAnswer: string
  criteria: { criterion: string; earned: number; possible: number; feedback: string }[]
}
export interface SubmissionPage { image: string; label: string }
export const MAX_WRITTEN_PAGES = 8
export const MAX_WRITTEN_PAYLOAD = 3_000_000
