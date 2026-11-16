CREATE TABLE "generation_jobs" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED' CHECK ("status" IN ('QUEUED','RUNNING','COMPLETED','FAILED')),
  "tasks" JSONB NOT NULL,
  "results" JSONB NOT NULL DEFAULT '[]',
  "cursor" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "leaseToken" TEXT,
  "leaseUntil" TIMESTAMPTZ,
  "notified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "generation_jobs_active_dedupe" ON "generation_jobs" ("userId", "dedupeKey") WHERE "status" IN ('QUEUED','RUNNING');
CREATE INDEX "generation_jobs_queue" ON "generation_jobs" ("status", "createdAt");
CREATE INDEX "generation_jobs_user" ON "generation_jobs" ("userId", "createdAt");
