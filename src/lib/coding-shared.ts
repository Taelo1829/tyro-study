/**
 * Coding-project definitions shared by the browser and the server:
 * languages, which files can be uploaded, and the marking feedback shape.
 */

export const CODING_LANGUAGES = {
  cpp: { label: "C++", extensions: [".cpp", ".cc", ".cxx", ".h", ".hpp"] },
  c: { label: "C", extensions: [".c", ".h"] },
  python: { label: "Python", extensions: [".py"] },
  javascript: { label: "JavaScript", extensions: [".js", ".mjs", ".jsx", ".html", ".css"] },
  typescript: { label: "TypeScript", extensions: [".ts", ".tsx"] },
  java: { label: "Java", extensions: [".java"] },
  csharp: { label: "C#", extensions: [".cs"] },
  sql: { label: "SQL", extensions: [".sql"] },
  php: { label: "PHP", extensions: [".php", ".html", ".css"] },
} as const

export type CodingLanguage = keyof typeof CODING_LANGUAGES

/** Any language's source files, plus small data/readme files a program may need */
export const UPLOAD_EXTENSIONS = [
  ...new Set([...Object.values(CODING_LANGUAGES).flatMap(l => [...l.extensions]), ".txt", ".md", ".csv", ".json", ".dat", ".in"]),
]

export const MAX_FILES = 10
export const MAX_FILE_BYTES = 100 * 1024
export const MAX_TOTAL_BYTES = 300 * 1024
export const SUBMISSIONS_PER_DAY = 10

export function extensionOf(name: string) {
  const dot = name.lastIndexOf(".")
  return dot === -1 ? "" : name.slice(dot).toLowerCase()
}

export interface RubricItem {
  criterion: string
  points: number
}

export interface ProjectFeedback {
  summary: string
  rubric: { criterion: string; points: number; max: number; comment: string }[]
  strengths: string[]
  improvements: string[]
}

export const PROJECT_PASS_MARK = 50
