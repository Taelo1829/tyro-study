"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronRight, UserPlus } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface ChapterRow {
  id: string
  title: string
  order: number
  _count: { topics: number }
}

interface ModuleDetail {
  id: string
  title: string
  description: string | null
  isEnrolled: boolean
  chapters: ChapterRow[]
}

export default function StudentModulePage() {
  const params = useParams()
  const id = params.id as string
  const [mod, setMod] = useState<ModuleDetail | null>(null)
  const [joining, setJoining] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/modules/${id}`)
    if (res.ok) setMod(await res.json())
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function joinModule() {
    setJoining(true)
    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId: id }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to join")
      }
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to join")
    } finally {
      setJoining(false)
    }
  }

  if (!mod) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  if (!mod.isEnrolled) {
    return (
      <>
        <Header title={mod.title} subtitle="Join to access content" />
        <Link
          href="/modules"
          className="mb-6 inline-block text-sm text-muted-foreground hover:text-primary"
        >
          ← All modules
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            {mod.description && (
              <p className="max-w-md text-sm text-muted-foreground">
                {mod.description}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Join this module to view chapters, topics, and quizzes.
            </p>
            <Button variant="primary" disabled={joining} onClick={joinModule}>
              <UserPlus className="h-4 w-4" />
              {joining ? "Joining…" : "Join module"}
            </Button>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      <Header title={mod.title} subtitle="Chapters in this module" />

      <Link
        href="/modules"
        className="mb-6 inline-block text-sm text-muted-foreground hover:text-primary"
      >
        ← My modules
      </Link>

      {mod.chapters.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No chapters published yet.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {mod.chapters.map((ch) => (
            <li key={ch.id}>
              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-semibold">{ch.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {ch._count.topics} topic{ch._count.topics !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
