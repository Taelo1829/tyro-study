import { Suspense } from "react"
import { Header } from "@/components/layout/header"
import { ModulesTabs } from "@/components/modules/modules-tabs"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { termsFor, asLevel } from "@/lib/levels"
import { getUserLevel } from "@/lib/levels-server"

export default async function ModulesPage() {
  // High school students see "Subjects"
  const session = await getServerSession(authOptions)
  const t = termsFor(session?.user?.id ? await getUserLevel(session.user.id) : asLevel(session?.user?.level))
  return (
    <>
      <Header
        title={t.Modules}
        subtitle={`Join ${t.modules} to access chapters, quizzes, and flashcards`}
      />
      {/* The tabs read ?tab= from the address */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading {t.modules}…</p>}>
        <ModulesTabs />
      </Suspense>
    </>
  )
}
