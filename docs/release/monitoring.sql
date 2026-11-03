-- Tyro Study: release monitoring queries. READ-ONLY.
-- Run in the Neon SQL editor on the production branch (or psql with the pooled URL).
-- Timestamps are stored in UTC; these convert to South African time (SAST, UTC+2).

-- 1. Choosing the release window: answers per hour of day (SAST), last 28 days.
--    Pick a weekday hour with the lowest counts.
SELECT to_char(("answeredAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Johannesburg', 'Dy') AS day,
       extract(hour FROM ("answeredAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Johannesburg')::int AS hour_sast,
       count(*) AS answers
FROM user_answers
WHERE "answeredAt" > now() - interval '28 days'
GROUP BY 1, 2
ORDER BY answers ASC
LIMIT 15;

-- 2. Baseline before the release: quizzes started and finished per hour, same weekday
--    last week, so the post-release numbers have something to compare with.
SELECT date_trunc('hour', ("startedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Johannesburg') AS hour_sast,
       count(*) AS started,
       count(*) FILTER (WHERE status = 'COMPLETED') AS completed
FROM quiz_attempts
WHERE "startedAt" > now() - interval '8 days'
GROUP BY 1
ORDER BY 1 DESC
LIMIT 48;

-- 3. After the release, every 15 minutes for the first hour: activity since the release.
--    The timestamp is the planned release start in UTC (06:00 SAST = 04:00 UTC); change it
--    if the release moves. Expect non-zero numbers in line
--    with query 2 for the same hour.
SELECT count(*)                                         AS answers_since_release,
       count(DISTINCT "userId")                         AS students_answering,
       round(100.0 * avg(CASE WHEN "isCorrect" THEN 1 ELSE 0 END), 1) AS pct_correct
FROM user_answers
WHERE "answeredAt" > timestamp '2026-11-03 04:00:00';

-- 4. Quizzes stuck "in progress" since the release (a finish problem shows up here).
SELECT count(*) AS started, count(*) FILTER (WHERE status = 'COMPLETED') AS completed,
       count(*) FILTER (WHERE status <> 'COMPLETED' AND "startedAt" < now() - interval '45 minutes') AS open_over_45_min
FROM quiz_attempts
WHERE "startedAt" > timestamp '2026-11-03 04:00:00';

-- 5. Analytics arriving (the analytics_events table is new in v1.0.0).
SELECT name, count(*) AS events, max("createdAt") AS latest_utc
FROM analytics_events
WHERE "createdAt" > timestamp '2026-11-03 04:00:00'
GROUP BY name
ORDER BY events DESC;

-- 6. Sign-ups since the release, by level (high school share matters for the POPIA decision).
SELECT coalesce(props->>'level', 'unknown') AS level, count(*) AS sign_ups
FROM analytics_events
WHERE name = 'sign_up' AND "createdAt" > timestamp '2026-11-03 04:00:00'
GROUP BY 1;

-- 7. Migration history: what Prisma has applied, newest first.
SELECT migration_name, finished_at, rolled_back_at
FROM _prisma_migrations
ORDER BY started_at DESC
LIMIT 5;
