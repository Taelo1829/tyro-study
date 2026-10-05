"use client"

import Link from "next/link"
import { ChevronRight, Code2 } from "lucide-react"
import { CODING_LANGUAGES, PROJECT_PASS_MARK, type CodingLanguage } from "@/lib/coding-shared"

export interface TopicProjectSummary {
  id: string
  title: string
  difficulty: string
  language: CodingLanguage
  best: number | null
  tries: number
}

const LEVEL_STYLE: Record<string, string> = {
  easy: "bg-green-100 text-green-800",
  medium: "bg-sky-100 text-sky-800",
  hard: "bg-orange-100 text-orange-800",
}

/** The topic's coding projects, each with the student's best mark so far */
export function TopicProjects({ projects, moduleId, topicId }: { projects: TopicProjectSummary[]; moduleId: string; topicId: string }) {
  return (
    <ul className="space-y-3">
      {projects.map(p => (
        <li key={p.id}>
          <Link
            href={`/modules/${moduleId}/topics/${topicId}/projects/${p.id}`}
            className="flex items-center gap-4 rounded-[1.5rem] border-2 border-foreground bg-white px-5 py-4 transition-colors hover:bg-muted/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
              <Code2 className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold leading-snug">{p.title}</span>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className={`rounded-full px-2 py-0.5 font-medium ${LEVEL_STYLE[p.difficulty] ?? LEVEL_STYLE.medium}`}>{p.difficulty}</span>
                <span>{CODING_LANGUAGES[p.language]?.label ?? p.language}</span>
                {p.best === null ? (
                  <span>Not submitted yet</span>
                ) : (
                  <span className={p.best >= PROJECT_PASS_MARK ? "font-semibold text-green-700" : "font-semibold text-orange-700"}>
                    Best {p.best}% · {p.tries} {p.tries === 1 ? "try" : "tries"}
                  </span>
                )}
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
