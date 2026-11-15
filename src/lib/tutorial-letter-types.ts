export const TUTORIAL_TOPIC_QUIZ_SIZE = 10
export interface BookChapter { ref: string; title: string; topics: { ref: string; title: string }[] }
export interface TutorialNote { text: string; evidence: string | string[] }
export interface TutorialAssessment {
  title: string; format: "mcq" | "written" | "mixed"; selfTest: boolean
  chapterRefs: string[]; instructions: string; evidence: string; weight: string
}
export interface TutorialGuide {
  sourceName: string; year: string; moduleCode: string; book: string; contentsSource: string
  notes: TutorialNote[]; studyPlan: { period: string; reading: string; evidence: string }[]
  assessments: TutorialAssessment[]; warnings: string[]
}
export interface TutorialPlan {
  guide: TutorialGuide; chapters: BookChapter[]
  retainedAssignments: { id: string; title: string; chapterRefs: string[] }[]
}
export interface TutorialPreview {
  id: string; plan: TutorialPlan; tasks: { key: string; title: string; complete: boolean }[]
  oldChapterCount: number; oldTopicCount: number; applied: boolean
}

/** A checkpoint belongs after ALL its prerequisites, never just the first match. */
export function tutorialCheckpointIndex(chapters: BookChapter[], refs: string[]) {
  if (!refs.length || new Set(refs).size !== refs.length) throw new Error("An assessment needs distinct prerequisite chapters.")
  const indices = refs.map(ref => chapters.findIndex(c => c.ref === ref))
  if (indices.some(i => i < 0)) throw new Error("An assessment references a chapter outside the proposed syllabus.")
  return Math.max(...indices)
}

/** Read explicit textbook references from a letter's assessment heading block.
 * Guide appendices are deliberately not mistaken for textbook appendices.
 */
export function explicitTutorialReading(title: string, source: string) {
  const identity = (value: string) => {
    const assignment = value.match(/assignment\s+0*(\d+)/i)
    if (assignment) return `assignment-${Number(assignment[1])}`
    const selfTest = value.match(/self[-\s]*test\s+([a-z])/i)
    return selfTest ? `self-test-${selfTest[1].toUpperCase()}` : null
  }
  const target = identity(title)
  const headings = [...source.matchAll(/^(?:ASSIGNMENT\s+\d+|SELF[-\s]*TEST\s+[A-Z])[^\n]*$/gm)]
  const index = headings.findIndex(h => identity(h[0]) === target && target !== null)
  if (index < 0) return { refs: [] as string[], preparesFor: null as string | null, evidence: null as string | null }
  const block = source.slice(headings[index].index, Math.min(headings[index].index! + 2200, headings[index + 1]?.index ?? source.length))
  const reading = block.match(/Stallings\s*:\s*Chapters?\s+((?:\d+\s*(?:,|and|&)?\s*)+)(?:Appendix\s+([A-Z]))?/i)
  const refs = reading ? [...(reading[1].match(/\d+/g) ?? []), ...(reading[2] ? [reading[2].toUpperCase()] : [])] : []
  const next = block.match(/(?:preparation|prerequisite)\s+for\s+Assignment\s+0*(\d+)/i)
  return { refs: [...new Set(refs)], preparesFor: next ? `Assignment ${Number(next[1])}` : null, evidence: block.slice(0, 300) }
}

/** Locate the original numbered row, without joining the header over other rows. */
export function tutorialAssessmentEvidence(title: string, source: string, evidence?: unknown): string | null {
  const heading = explicitTutorialReading(title, source).evidence
  if (heading) return heading
  const identity = title.match(/\b(assignment|assessment|quiz|written|mcq|multiple[- ]choice|practical|project|portfolio|test)\s+(?:(?:assignment|assessment|quiz|test)\s+)?(?:no\.?\s*|#\s*)?0*(\d+)\b/i)
  if (!identity) return null
  const [, label, number] = identity
  const matches: string[] = []
  const quotedMatches: string[] = []
  const method = (value: string) => value.toLowerCase().replace(/-/g, " ")
  const compact = (value: string) => value.normalize("NFC").replace(/\s+/g, "").toLowerCase()
  const generic = /^(assignment|assessment)$/i.test(label)
  for (const header of source.matchAll(/Assessment\s+number\s+Method\s+of\s+assessment/gi)) {
    const start = header.index! + header[0].length
    const following = source.slice(start, start + 6000)
    const sectionEnd = following.search(/\n\s*\d+\.\d+\s+\S/)
    const table = sectionEnd < 0 ? following : following.slice(0, sectionEnd)
    const rows = [...table.matchAll(/^\s*(\d+)[.)]\s+(Quiz|Written|MCQ|Multiple[- ]choice|Practical|Project|Portfolio|Test)\b/gim)]
    let methodOrdinal = 0
    for (let i = 0; i < rows.length; i++) {
      const sameMethod = method(label) === method(rows[i][2])
      if (sameMethod) methodOrdinal++
      // "Assignment 4" is the table's row number. "Quiz 3" may be
      // the third quiz (row 4 when a written assessment precedes it).
      if (generic ? Number(rows[i][1]) !== Number(number) : !sameMethod || (Number(rows[i][1]) !== Number(number) && methodOrdinal !== Number(number))) continue
      const row = table.slice(rows[i].index, rows[i + 1]?.index ?? table.length).trim()
      // Only recognize a complete weighted assessment row, not arbitrary lists.
      if (row.length <= 600 && /\d+(?:\.\d+)?\s*%\s*$/.test(row)) {
        matches.push(row)
        if (typeof evidence === "string" && compact(evidence) === compact(row)) quotedMatches.push(row)
      }
    }
  }
  // The exact quoted row disambiguates numbering schemes; never guess between
  // multiple rows or accept a changed weight/outcome range as an exact match.
  return quotedMatches.length === 1 ? quotedMatches[0] : matches.length === 1 ? matches[0] : null
}
