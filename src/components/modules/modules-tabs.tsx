"use client"

import { useCallback, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { BookOpen, Search } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ModuleCatalog } from "./module-catalog"
import { useTerms } from "@/hooks/use-level"

type Tab = "mine" | "browse"

/**
 * Modules page: "My modules" and "Browse modules" tabs. The tab is kept in
 * the address (?tab=browse) so links can open Browse directly; a course link
 * (?course=…) opens Browse too. Students who haven't joined anything yet land
 * on Browse.
 */
export function ModulesTabs() {
  const t = useTerms()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const asked: Tab | null = params.get("tab") === "browse" || params.get("course") ? "browse" : params.get("tab") === "mine" ? "mine" : null
  const [tab, setTab] = useState<Tab>(asked ?? "mine")
  const autoSwitched = useRef(false)

  const choose = useCallback(
    (next: Tab) => {
      setTab(next)
      const q = new URLSearchParams(params.toString())
      q.delete("course")
      if (next === "browse") q.set("tab", "browse")
      else q.delete("tab")
      router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false })
    },
    [params, pathname, router]
  )

  // Nothing joined yet: show what there is to join (only on first load, without an explicit tab)
  const onMyCount = useCallback(
    (count: number) => {
      if (count === 0 && !asked && !autoSwitched.current) {
        autoSwitched.current = true
        setTab("browse")
      }
    },
    [asked]
  )

  return (
    <Tabs value={tab} onValueChange={v => choose(v as Tab)} className="space-y-5">
      <TabsList className="grid w-full grid-cols-2 border border-foreground shadow-none sm:w-auto sm:min-w-[22rem]">
        <TabsTrigger value="mine" className="gap-2">
          <BookOpen className="h-4 w-4" /> My {t.modules}
        </TabsTrigger>
        <TabsTrigger value="browse" className="gap-2">
          <Search className="h-4 w-4" /> Browse {t.modules}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="mine">
        <p className="mb-4 text-sm text-muted-foreground">{t.Modules} you have joined. Open one to start studying.</p>
        <ModuleCatalog showEnrolledOnly onBrowse={() => choose("browse")} onCount={onMyCount} />
      </TabsContent>

      <TabsContent value="browse">
        <p className="mb-4 text-sm text-muted-foreground">Choose a {t.course}, then join {t.modules} with one click.</p>
        <ModuleCatalog showAvailableOnly searchable />
      </TabsContent>
    </Tabs>
  )
}
