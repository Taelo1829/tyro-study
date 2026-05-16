"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { BookOpen, ChevronRight, UserMinus, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
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
}

export function ModuleCatalog({
  showEnrolledOnly = false,
  showAvailableOnly = false,
}: ModuleCatalogProps) {
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
    load()
  }, [load, reload])


  async function enroll(moduleId: string) {
    setActionId(moduleId)
    setLoading(true)

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
    setLoading(true)
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

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading modules…</p>
  }

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

  return (
    <ul className="space-y-3">
      {filtered.map((m) => (
        <li key={m.id}>
          <Card>
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                {m.isEnrolled ? (
                  <Link href={`/modules/${m.id}`} className="group block">
                    <p className="font-semibold group-hover:text-primary">
                      {m.title}
                    </p>
                  </Link>
                ) : (
                  <p className="font-semibold">{m.title}</p>
                )}
                {m.description && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {m.description}
                  </p>
                )}
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5" />
                  {m._count.chapters} chapter{m._count.chapters !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {m.isEnrolled ? (
                  <>
                    <Button variant="primary" size="sm" asChild>
                      <Link href={`/modules/${m.id}`}>
                        Open
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={actionId === m.id}
                      onClick={() => unenroll(m.id)}
                    >
                      <UserMinus className="h-4 w-4" />
                      Leave
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={actionId === m.id}
                    onClick={() => enroll(m.id)}
                  >
                    <UserPlus className="h-4 w-4" />
                    {actionId === m.id ? "Joining…" : "Join module"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}
