-- Calendar reminders: when to notify, and when the notification went out
ALTER TABLE "calendar_events" ADD COLUMN "remindAt" TIMESTAMP(3);
ALTER TABLE "calendar_events" ADD COLUMN "remindedAt" TIMESTAMP(3);

-- The reminder job looks events up by reminder time
CREATE INDEX "calendar_events_remindAt_idx" ON "calendar_events"("remindAt");
