/**
 * Study levels. Tertiary students study university modules grouped into
 * courses (qualifications); high school students study Grade 11 and 12
 * subjects grouped into grades. The app is the same for both; only the words
 * change (module → subject, course → grade) and what each student sees.
 *
 * Safe to import on the client.
 */

export type StudyLevel = "tertiary" | "highschool"

export const STUDY_LEVELS: { id: StudyLevel; label: string; hint: string }[] = [
  { id: "highschool", label: "High school", hint: "Grade 11 and 12 subjects (CAPS)" },
  { id: "tertiary", label: "University or college", hint: "University modules (UNISA)" },
]

export const HIGH_SCHOOL_GRADES = [11, 12] as const

export function asLevel(value: unknown): StudyLevel {
  return value === "highschool" ? "highschool" : "tertiary"
}

export function isStudyLevel(value: unknown): value is StudyLevel {
  return value === "highschool" || value === "tertiary"
}

export interface LevelTerms {
  /** "module" / "subject" */
  module: string
  modules: string
  Module: string
  Modules: string
  /** "course" / "grade" */
  course: string
  Course: string
  courses: string
}

export function termsFor(level: StudyLevel | null | undefined): LevelTerms {
  return level === "highschool"
    ? { module: "subject", modules: "subjects", Module: "Subject", Modules: "Subjects", course: "grade", Course: "Grade", courses: "grades" }
    : { module: "module", modules: "modules", Module: "Module", Modules: "Modules", course: "course", Course: "Course", courses: "courses" }
}

/** "Physical Sciences - Grade 12" → 12; high school subjects carry their grade in the name */
export function gradeOfTitle(title: string): number | null {
  const m = title.match(/\bGrade\s*(1[0-2]|[89])\b/i)
  return m ? Number(m[1]) : null
}
