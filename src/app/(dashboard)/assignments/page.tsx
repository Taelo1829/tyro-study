import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"

export default function AssignmentsPage() {
  return (
    <>
      <Header title="Assignments" subtitle="Track due dates and completion" />
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No assignments yet.
        </CardContent>
      </Card>
    </>
  )
}
