"use client"

import { toPlainText } from "@/lib/plain-text"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { BookOpen, ChevronRight, GraduationCap, Search, UserMinus, UserPlus, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useModuleStore } from "@/app/(dashboard)/modules/store"
import { BROWSE_COURSE_KEY } from "./use-course-crumb"

export interface ModuleItem {
  id: string
  title: string
  description: string | null
  isEnrolled: boolean
  enrolledAt?: string | null
  _count: { chapters: number; enrollments?: number }
  /** Courses this module is part of (can be several, or none) */
  courseIds?: string[]
}

interface CourseItem {
  id: string
  title: string
  description: string | null
  /** In the order the admin arranged them */
  moduleIds: string[]
}

/** "all" | a course id | "other" (modules in no course) */
type CourseChoice = string
const COURSE_KEY = BROWSE_COURSE_KEY

interface ModuleCatalogProps {
  showEnrolledOnly?: boolean
  showAvailableOnly?: boolean
  /** Show course chips and a search box above the list */
  searchable?: boolean
}

export function ModuleCatalog({
  showEnrolledOnly = false,
  showAvailableOnly = false,
  searchable = false,
}: ModuleCatalogProps) {
  const [query, setQuery] = useState("")
  const [modules, setModules] = useState<ModuleItem[]>([])
  const [courses, setCourses] = useState<CourseItem[]>([])
  const [course, setCourseState] = useState<CourseChoice>("all")
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const { reload, toggleReload } = useModuleStore()
  const load = useCallback(async () => {
    const [res, courseRes] = await Promise.all([fetch("/api/modules"), fetch("/api/courses")])
    if (res.ok) {
      const mods: ModuleItem[] = await res.json()
      setModules(mods)
    }
    if (courseRes.ok) setCourses(await courseRes.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    queueMicrotask(load)
  }, [load, reload])

  // Remember the course a student was browsing (this browser only)
  useEffect(() => {
    if (!searchable) return
    queueMicrotask(() => {
      // A course crumb links to /modules?course=<id>; otherwise use the last one picked
      const fromLink = new URLSearchParams(window.location.search).get("course")
      if (fromLink) {
        setCourseState(fromLink)
        try {
          localStorage.setItem(COURSE_KEY, fromLink)
        } catch {}
        return
      }
      try {
        const saved = localStorage.getItem(COURSE_KEY)
        if (saved) setCourseState(saved)
      } catch {}
    })
  }, [searchable])

  function setCourse(choice: CourseChoice) {
    setCourseState(choice)
    try {
      localStorage.setItem(COURSE_KEY, choice)
    } catch {}
  }


  async function enroll(moduleId: string) {
    setActionId(moduleId)

    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Enrollment failed")
      }
      toggleReload()

    } catch (err) {
      alert(err instanceof Error ? err.message : "Enrollment failed")
    } finally {
      setActionId(null)
    }
  }

  async function unenroll(moduleId: string) {
    if (!confirm("Leave this module? Your progress is kept, but it will be hidden from your list.")) {
      return
    }
    setActionId(moduleId)
    try {
      const res = await fetch(`/api/enrollments/${moduleId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to leave module")
      }
      toggleReload()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to leave module")
    } finally {
      setActionId(null)
    }
  }

  const filtered = modules.filter((m) => {
    if (showEnrolledOnly) return m.isEnrolled
    if (showAvailableOnly) return !m.isEnrolled
    return true
  })

  const courseTitle = new Map(courses.map(c => [c.id, c.title]))
  // Only offer courses that have modules, and "Other modules" only if some module has no course
  const courseChips = courses.filter(c => c.moduleIds.length > 0)
  const hasLoose = modules.some(m => !m.courseIds?.length)
  const showChips = searchable && courseChips.length > 0
  const activeCourse = courseChips.find(c => c.id === course)
  // A remembered course that no longer exists falls back to All
  const choice: CourseChoice =
    !showChips ? "all" : activeCourse ? course : course === "other" && hasLoose ? "other" : "all"

  // Pick the course first, then search within it
  const inCourse = !showChips || choice === "all"
    ? filtered
    : choice === "other"
      ? filtered.filter(m => !m.courseIds?.length)
      : activeCourse!.moduleIds.map(id => filtered.find(m => m.id === id)).filter((m): m is ModuleItem => !!m)

  // Every word typed must appear in the module's name or description, in any order
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const matches = words.length
    ? inCourse.filter(m => {
        const text = `${m.title} ${toPlainText(m.description)}`.toLowerCase()
        return words.every(w => text.includes(w))
      })
    : inCourse

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading modules…</p>
  }

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${active ? "border-foreground bg-foreground text-background" : "border-border bg-white text-foreground hover:border-foreground"}`

  const coursePicker = showChips && (
    <div className="mb-3">
      <div role="tablist" aria-label="Course" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        <button type="button" role="tab" aria-selected={choice === "all"} className={chip(choice === "all")} onClick={() => setCourse("all")}>
          All courses
        </button>
        {courseChips.map(c => (
          <button key={c.id} type="button" role="tab" aria-selected={choice === c.id} className={chip(choice === c.id)} onClick={() => setCourse(c.id)}>
            {c.title}
          </button>
        ))}
        {hasLoose && (
          <button type="button" role="tab" aria-selected={choice === "other"} className={chip(choice === "other")} onClick={() => setCourse("other")}>
            Other modules
          </button>
        )}
      </div>
      {activeCourse && toPlainText(activeCourse.description) && (
        <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
          <GraduationCap className="mt-0.5 h-4 w-4 shrink-0" />
          {toPlainText(activeCourse.description)}
        </p>
      )}
    </div>
  )

  const searchBox = searchable && filtered.length > 0 && (
    <form role="search" onSubmit={e => e.preventDefault()} className="relative mb-4">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search modules, e.g. MAT1503"
        aria-label="Search modules"
        className="h-12 w-full rounded-full border border-foreground bg-white pl-11 pr-11 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40 [&::-webkit-search-cancel-button]:hidden"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  )

  if (filtered.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {showEnrolledOnly
            ? "You haven't joined any modules yet. Browse available modules below."
            : showAvailableOnly
              ? "You're enrolled in all available modules."
              : "No modules available yet."}
        </CardContent>
      </Card>
    )
  }

  // Card with a black action bar along the bottom: Open | Leave once joined, Join before
  const bar =
    "flex min-h-12 flex-1 items-center justify-center gap-2 px-4 text-sm font-semibold text-background transition-colors hover:bg-white/10 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"

  if (matches.length === 0) {
    return (
      <>
        {coursePicker}
        {searchBox}
        <p className="py-6 text-center text-sm text-muted-foreground">
          {words.length
            ? <>No modules match &ldquo;{query.trim()}&rdquo;{choice !== "all" && " in this course"}.</>
            : choice === "other"
              ? "You've joined all the other modules."
              : `You've joined every module in ${activeCourse?.title ?? "this course"}.`}
        </p>
      </>
    )
  }

  return (
    <>
    {coursePicker}
    {searchBox}
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {matches.map((m) => {
        const busy = actionId === m.id
        const description = toPlainText(m.description)
        return (
          <li key={m.id} className="flex flex-col overflow-hidden rounded-[2rem] border-2 border-foreground bg-white">
            <div className="flex-1 px-5 pb-4 pt-5">
              {m.isEnrolled ? (
                <Link href={`/modules/${m.id}`} className="font-semibold leading-snug hover:underline">
                  {m.title}
                </Link>
              ) : (
                <p className="font-semibold leading-snug">{m.title}</p>
              )}
              {description && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{description}</p>}
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5" />
                {m._count.chapters} chapter{m._count.chapters !== 1 ? "s" : ""}
                {choice === "all" && m.courseIds?.some(id => courseTitle.has(id)) && (
                  <span className="truncate">
                    {" · "}
                    {m.courseIds.map(id => courseTitle.get(id)).filter(Boolean).join(", ")}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-stretch bg-foreground">
              {m.isEnrolled ? (
                <>
                  <Link href={`/modules/${m.id}`} className={bar}>
                    Open
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                  <span aria-hidden="true" className="w-0.5 shrink-0 bg-background" />
                  <button type="button" className={bar} disabled={busy} onClick={() => unenroll(m.id)}>
                    <UserMinus className="h-4 w-4" />
                    {busy ? "Leaving…" : "Leave"}
                  </button>
                </>
              ) : (
                <button type="button" className={bar} disabled={busy} onClick={() => enroll(m.id)}>
                  <UserPlus className="h-4 w-4" />
                  {busy ? "Joining…" : "Join module"}
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
    </>
  )
}
