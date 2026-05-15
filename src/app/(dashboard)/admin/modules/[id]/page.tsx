"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronRight, Plus } from "lucide-react"
import { Header } from "@/components/layout/header"
import { EntityForm } from "@/components/admin/entity-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
  chapters: ChapterRow[]
}

export default function AdminModuleDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [mod, setMod] = useState<ModuleDetail | null>(null)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/modules/${id}`)
    if (res.ok) setMod(await res.json())
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (!mod) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  return (
    <>
      <Header title={mod.title} subtitle="Chapters in this module" />

      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/admin/modules"
          className="text-sm text-muted-foreground hover:text-primary"
        >
          ← Modules
        </Link>
        <Button variant="primary" size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" />
          New chapter
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create chapter</CardTitle>
          </CardHeader>
          <CardContent>
            <EntityForm
              fields={[{ name: "title", label: "Chapter title", required: true }]}
              submitLabel="Create chapter"
              onCancel={() => setShowForm(false)}
              onSubmit={async (values) => {
                const res = await fetch("/api/chapters", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ moduleId: id, title: values.title }),
                })
                if (!res.ok) {
                  const data = await res.json()
                  throw new Error(data.error ?? "Failed")
                }
                setShowForm(false)
                await load()
              }}
            />
          </CardContent>
        </Card>
      )}

      <ul className="space-y-3">
        {mod.chapters.map((ch) => (
          <li key={ch.id}>
            <Link href={`/admin/chapters/${ch.id}`}>
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
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
