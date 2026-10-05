import { Suspense } from "react"
import { Header } from "@/components/layout/header"
import { ModulesTabs } from "@/components/modules/modules-tabs"

export default function ModulesPage() {
  return (
    <>
      <Header
        title="Modules"
        subtitle="Join modules to access chapters, quizzes, and flashcards"
      />
      {/* The tabs read ?tab= from the address */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading modules…</p>}>
        <ModulesTabs />
      </Suspense>
    </>
  )
}
