"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { Header } from "@/components/layout/header"
import { useCourseCrumb } from "@/components/modules/use-course-crumb"
import { ProgressReport, type ModuleProgressData } from "@/components/progress/progress-report"

/** A student's quiz tracking for one module */
export default function ModuleProgressPage() {
  const { id } = useParams<{ id: string }>()
  const courseCrumb = useCourseCrumb(id)
  const [data, setData] = useState<ModuleProgressData | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let live = true
    fetch(`/api/progress/module/${id}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("Couldn't load your progress"))))
      .then(d => live && setData(d))
      .catch(e => live && setError(e.message))
    return () => {
      live = false
    }
  }, [id])

  return (
    <>
      <Breadcrumbs items={[{ label: "My modules", href: "/modules" }, ...courseCrumb, { label: data?.title ?? "Module", href: `/modules/${id}` }, { label: "Progress" }]} />
      <Header title="Your progress" subtitle={data?.title ?? "Quizzes passed, failed and how long they take"} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
      {data && <ProgressReport data={data} moduleHref={`/modules/${id}`} />}
    </>
  )
}
