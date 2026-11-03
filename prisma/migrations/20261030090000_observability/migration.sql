-- Observability (business/11): grouped production errors and job heartbeats.
-- Additive only: two new tables, no change to existing ones.

-- One row per distinct error ("issue"), like an error tracker groups them.
-- Repeats bump "count" and "lastSeenAt" instead of adding rows.
CREATE TABLE "error_events" (
    "fingerprint" TEXT NOT NULL,
    "source" TEXT NOT NULL,              -- 'server' | 'client'
    "message" TEXT NOT NULL,             -- first line, redacted, max 500 chars
    "route" TEXT,                        -- route file path or page path template
    "sampleRequestId" TEXT,              -- x-vercel-id of the latest occurrence
    "digest" TEXT,                       -- Next.js error digest (server render errors)
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),           -- set by an admin; a new occurrence reopens it

    CONSTRAINT "error_events_pkey" PRIMARY KEY ("fingerprint")
);

CREATE INDEX "error_events_lastSeenAt_idx" ON "error_events"("lastSeenAt");

-- Last run of each scheduled job, so a job that silently stops is noticed.
CREATE TABLE "app_heartbeats" (
    "name" TEXT NOT NULL,                -- e.g. 'cron:reminders'
    "lastRunAt" TIMESTAMP(3) NOT NULL,
    "lastOkAt" TIMESTAMP(3),
    "lastError" TEXT,
    "details" JSONB,

    CONSTRAINT "app_heartbeats_pkey" PRIMARY KEY ("name")
);
