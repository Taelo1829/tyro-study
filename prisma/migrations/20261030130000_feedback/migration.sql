-- In-app feedback from students (business/12). Additive only.
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,                -- 'bug' | 'idea' | 'content' | 'other'
    "message" TEXT NOT NULL,
    "page" TEXT,                         -- route template the student came from
    "appVersion" TEXT,                   -- deployed commit (short)
    "status" TEXT NOT NULL DEFAULT 'new',-- 'new' | 'planned' | 'done' | 'wontfix'
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feedback_status_createdAt_idx" ON "feedback"("status", "createdAt");

ALTER TABLE "feedback" ADD CONSTRAINT "feedback_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
