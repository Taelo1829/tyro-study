"use client"

import { useSession } from "next-auth/react"
import { asLevel, termsFor, type LevelTerms, type StudyLevel } from "@/lib/levels"

/** The signed-in student's study level (tertiary until known) */
export function useLevel(): StudyLevel {
  const { data } = useSession()
  return asLevel(data?.user?.level)
}

/** Words for the student's level: module/subject, course/grade */
export function useTerms(): LevelTerms {
  return termsFor(useLevel())
}
