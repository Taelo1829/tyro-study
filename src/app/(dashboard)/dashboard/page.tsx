import { Header } from "@/components/layout/header"
import { DashboardWidget } from "@/components/dashboard/dashboard-widget"
import { StudyProgressDonut } from "@/components/dashboard/study-progress-donut"
import { Flame, BookOpen, Calendar, ClipboardList } from "lucide-react"

export default function DashboardPage() {
  return (
    <>
      <Header
        title="Dashboard"
        subtitle="Your study overview for today"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardWidget
          title="Study Progress"
          description="Overall completion across modules"
          delay={0}
        >
          <StudyProgressDonut percent={0} />
        </DashboardWidget>

        <DashboardWidget
          title="Current Streak"
          description="Consecutive study days"
          delay={0.05}
        >
          <div className="flex items-center gap-4">
            <div className="neo-pressed flex h-14 w-14 items-center justify-center rounded-full">
              <Flame className="h-7 w-7 text-accent" />
            </div>
            <div>
              <p className="text-3xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">days in a row</p>
            </div>
          </div>
        </DashboardWidget>

        <DashboardWidget
          title="Topic Up Next"
          description="Continue where you left off"
          delay={0.1}
        >
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              No topics scheduled yet. Enroll in a module to get started.
            </p>
          </div>
        </DashboardWidget>

        <DashboardWidget
          title="Today&apos;s Study Plan"
          description="From your timetable"
          delay={0.15}
        >
          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              No sessions planned for today.
            </p>
          </div>
        </DashboardWidget>

        <DashboardWidget
          title="Upcoming Assignments"
          description="Due soon"
          delay={0.2}
        >
          <div className="flex items-start gap-3">
            <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              No assignments due. Add one from the Timetable.
            </p>
          </div>
        </DashboardWidget>
      </div>
    </>
  )
}
