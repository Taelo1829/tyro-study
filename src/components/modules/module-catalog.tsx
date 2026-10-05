"use client"

import { toPlainText } from "@/lib/plain-text"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { BookOpen, ChevronRight, Search, UserMinus, UserPlus, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useModuleStore } from "@/app/(dashboard)/modules/store"

export interface ModuleItem {
  id: string
  title: string
  description: string | null
  isEnrolled: boolean
  enrolledAt?: string | null
  _count: { chapters: number; enrollments?: number }
}

interface ModuleCatalogProps {
  showEnrolledOnly?: boolean
  showAvailableOnly?: boolean
  /** Show a search box above the list (filters by name and description) */
  searchable?: boolean
}

export function ModuleCatalog({
  showEnrolledOnly = false,
  showAvailableOnly = false,
  searchable = false,
}: ModuleCatalogProps) {
  const [query, setQuery] = useState("")
  const [modules, setModules] = useState<ModuleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const { reload, toggleReload } = useModuleStore()
  const load = useCallback(async () => {
    const res = await fetch("/api/modules")
    if (res.ok) {
      const mods: ModuleItem[] = await res.json()
      setModules(mods)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    queueMicrotask(load)
  }, [load, reload])


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

  // Every word typed must appear in the module's name or description, in any order
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const matches = words.length
    ? filtered.filter(m => {
        const text = `${m.title} ${toPlainText(m.description)}`.toLowerCase()
        return words.every(w => text.includes(w))
      })
    : filtered

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading modules…</p>
  }

  const searchBox = searchable && filtered.length > 0 && (
    <form role="search" onSubmit={e => e.preventDefault()} className="relative mb-4">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search modules by name or code, e.g. MAT1503"
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
        {searchBox}
        <p className="py-6 text-center text-sm text-muted-foreground">
          No modules match &ldquo;{query.trim()}&rdquo;.
        </p>
      </>
    )
  }

  return (
    <>
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
