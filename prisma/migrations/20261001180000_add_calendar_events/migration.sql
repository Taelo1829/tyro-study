-- Calendar-based timetable: study sessions, assignment due dates, exams, reminders
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'STUDY_SESSION',
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_events_userId_startAt_idx" ON "calendar_events"("userId", "startAt");

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Carry existing timetable entries over as assignment due dates
INSERT INTO "calendar_events" ("id", "userId", "moduleId", "type", "title", "notes", "startAt", "completed")
SELECT
    'tt_' || t."id",
    t."userId",
    t."moduleId",
    'ASSIGNMENT',
    t."assignmentTitle",
    CASE WHEN t."chaptersPlanned" > 0
         THEN 'Chapters: ' || t."chaptersCompleted" || ' of ' || t."chaptersPlanned" || ' done'
    END,
    t."dueDate",
    (t."chaptersPlanned" > 0 AND t."chaptersCompleted" >= t."chaptersPlanned")
FROM "timetable" t;
