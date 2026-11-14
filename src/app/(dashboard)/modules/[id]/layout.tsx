"use client"

import { useEffect, type ReactNode } from "react"
import { useParams, usePathname } from "next/navigation"

export default function ModuleLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>()
  const pathname = usePathname()
  useEffect(() => {
    // Direct links to lessons, chapters and quizzes also count as opening the module.
    void fetch(`/api/modules/${encodeURIComponent(id)}/opened`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {})
  }, [id, pathname])
  return children
}
