/**
 * Code with blanks to fill in, shared by the "Try it yourself" exercises in
 * coding lessons and the type-the-answer quiz questions.
 *
 * A blank is written as four or more underscores (____) in the code. Answers
 * are compared ignoring spacing that doesn't change the meaning, so
 * `x>=5`, `x >= 5` and ` x>= 5 ` all match, but `x > 5` doesn't.
 */

/** Where a blank goes: 4+ underscores not inside a longer name */
export const BLANK = /(?<![A-Za-z0-9])_{4,}(?![A-Za-z0-9])/g

export function countBlanks(code: string): number {
  return [...code.matchAll(BLANK)].length
}

/** The code cut at its blanks: text, blank, text, blank, … text */
export function splitAtBlanks(code: string): string[] {
  return code.split(BLANK)
}

/**
 * The form two answers are compared in: trimmed, a trailing ; dropped, quotes
 * made straight, and spaces kept only between two word characters
 * (`int x` stays apart, `x >= 5` → `x>=5`).
 */
export function normaliseAnswer(value: string): string {
  return value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .trim()
    .replace(/;+$/, "")
    .replace(/\s+/g, " ")
    .replace(/ ?([^\w ]) ?/g, "$1")
    .trim()
}

/** Does a typed answer match one of the accepted answers? */
export function answerMatches(typed: string, accepted: string[]): boolean {
  const t = normaliseAnswer(typed)
  if (!t) return false
  return accepted.some(a => normaliseAnswer(a) === t)
}

/** The index of the accepted answer the typed one matches, or -1 */
export function matchingAnswer(typed: string, accepted: string[]): number {
  const t = normaliseAnswer(typed)
  return t ? accepted.findIndex(a => normaliseAnswer(a) === t) : -1
}
