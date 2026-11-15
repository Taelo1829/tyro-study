import { RecreationInputError } from "./module-recreation-input"

// Normalise typography only; case can distinguish variables or code answers.
const textKey = (value: string) => value.normalize("NFC").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim()

/** Resolve an explicit answer reference back to the untouched source option.
 * Never infer an answer by substring similarity or silently choose the first.
 */
export function assignmentChoiceAnswer(options: string[], answer: unknown, index?: unknown) {
  let textIndex: number | undefined
  if (typeof answer === "string" && answer.trim()) {
    const exact = options.map((option, i) => ({ option, i })).filter(({ option }) => textKey(option) === textKey(answer))
    if (exact.length > 1) throw new RecreationInputError("The correct answer matches multiple options.")
    if (exact.length === 1) textIndex = exact[0].i
    else {
      const label = answer.trim().match(/^(?:option\s+)?([a-f])(?:[.)])?(?:\s+([\s\S]+))?$/i)
      if (label) {
        const position = label[1].toLowerCase().charCodeAt(0) - 97
        if (position < options.length && (!label[2] || textKey(label[2]) === textKey(options[position]))) textIndex = position
      }
    }
  }
  if (index !== undefined && index !== null) {
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= options.length) {
      throw new RecreationInputError("The correct-answer option index is out of range.")
    }
    if (textIndex !== undefined && textIndex !== index) throw new RecreationInputError("The answer text and option index disagree.")
    return options[index]
  }
  if (textIndex === undefined) throw new RecreationInputError("The correct answer could not be matched to an original option.")
  return options[textIndex]
}
