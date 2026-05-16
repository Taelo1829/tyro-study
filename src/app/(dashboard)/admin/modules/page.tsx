"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight, Plus } from "lucide-react"
import { Header } from "@/components/layout/header"
import { EntityForm } from "@/components/admin/entity-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ModuleRow {
  id: string
  title: string
  description: string | null
  _count: { chapters: number }
}

export default function AdminModulesPage() {
  const [modules, setModules] = useState<ModuleRow[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch("/api/modules")
    const data = await res.json()
    setModules(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <Header
        title="Modules"
        subtitle="Top level of your content hierarchy"
      />

      <div className="mb-4 flex items-center justify-between">
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary">
          ← Admin
        </Link>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" />
          New module
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create module</CardTitle>
          </CardHeader>
          <CardContent>
            <EntityForm
              fields={[
                { name: "title", label: "Title", required: true },
                {
                  name: "description",
                  label: "Description",
                  type: "textarea",
                },
              ]}
              submitLabel="Create module"
              onCancel={() => setShowForm(false)}
              onSubmit={async (values) => {
                const res = await fetch("/api/modules", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(values),
                })
                if (!res.ok) {
                  const data = await res.json()
                  throw new Error(data.error ?? "Failed to create")
                }
                setShowForm(false)
                await load()
              }}
            />
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : modules.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No modules yet. Create your first module above.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {modules.map((m) => (
            <li key={m.id}>
              <Link href={`/admin/modules/${m.id}`}>
                <Card className="flex items-center justify-between transition-transform hover:scale-[1.01]">
                  <CardContent className="flex flex-1 items-center justify-between py-4">
                    <div>
                      <p className="font-semibold">{m.title}</p>
                      {m.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {m.description}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {m._count.chapters} chapter{m._count.chapters !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
