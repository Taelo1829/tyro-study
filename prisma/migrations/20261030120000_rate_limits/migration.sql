-- Fixed-window rate limits (business/12, TS-008): one row per key, e.g.
-- 'login:email:<hash>' or 'login:ip:<hash>'. Additive only.
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "rate_limits_windowStart_idx" ON "rate_limits"("windowStart");
