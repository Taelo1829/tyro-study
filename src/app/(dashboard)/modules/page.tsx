import { Header } from "@/components/layout/header"
import { ModuleCatalog } from "@/components/modules/module-catalog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ModulesPage() {
  return (
    <>
      <Header
        title="Modules"
        subtitle="Join modules to access chapters, quizzes, and flashcards"
      />

      <div className="space-y-8">
        <section>
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">My modules</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="mb-4 text-sm text-muted-foreground">
                Modules you have joined. Open one to start studying.
              </p>
              <ModuleCatalog showEnrolledOnly />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Browse modules</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="mb-4 text-sm text-muted-foreground">
                Choose from available modules and join with one click.
              </p>
              <ModuleCatalog showAvailableOnly />
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  )
}
