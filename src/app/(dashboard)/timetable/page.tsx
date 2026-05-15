import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"

export default function TimetablePage() {
  return (
    <>
      <Header title="Timetable" subtitle="Plan study sessions and track assignments" />
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Your study schedule will appear here.
        </CardContent>
      </Card>
    </>
  )
}
