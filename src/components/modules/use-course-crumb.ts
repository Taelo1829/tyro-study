"use client"

import { useEffect, useState } from "react"
import type { Crumb } from "@/components/layout/breadcrumbs"

/** Same key Browse modules uses to remember the course a student picked */
export const BROWSE_COURSE_KEY = "tyro.browseCourse"

interface CourseLite {
  id: string
  title: string
  moduleIds: string[]
}

let coursesPromise: Promise<CourseLite[]> | null = null
function loadCourses() {
  coursesPromise ??= fetch("/api/courses")
    .then(r => (r.ok ? r.json() : []))
    .catch(() => [])
  return coursesPromise
}

/**
 * The course crumb to put before a module in breadcrumbs: the course the
 * student is browsing if the module is in it, otherwise the module's only
 * course. A module in several courses with none picked gets no course crumb.
 */
export function useCourseCrumb(moduleId: string | undefined): Crumb[] {
  const [crumb, setCrumb] = useState<Crumb[]>([])

  useEffect(() => {
    if (!moduleId) return
    let cancelled = false
    loadCourses().then(courses => {
      if (cancelled) return
      const mine = courses.filter(c => c.moduleIds.includes(moduleId))
      let browsing: string | null = null
      try {
        browsing = localStorage.getItem(BROWSE_COURSE_KEY)
      } catch {}
      const course = mine.find(c => c.id === browsing) ?? (mine.length === 1 ? mine[0] : null)
      setCrumb(course ? [{ label: course.title, href: `/modules?course=${encodeURIComponent(course.id)}` }] : [])
    })
    return () => {
      cancelled = true
    }
  }, [moduleId])

  return crumb
}
