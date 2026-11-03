# 0003 PostgreSQL on Neon through Prisma

- **Status:** Accepted
- **Date:** 2026-10-29 (records the existing choice)

## Context
The data is relational (course → module → chapter → topic → question, attempts, enrolments) and analytics need joins and date maths in South African time. Vercel functions open many short connections.

## Decision
PostgreSQL on Neon. The app uses the **pooled** URL (`DATABASE_URL`); Prisma migrations use the **direct** URL (`DIRECT_DATABASE_URL`, host without `-pooler`). Prisma 7 with `@prisma/adapter-pg` and a single client per instance (`src/lib/prisma.ts`). Timestamps are stored in UTC; days are worked out in SQL with `AT TIME ZONE 'Africa/Johannesburg'`.

Migrations: `prisma migrate dev` only against a local or branch database; `prisma migrate deploy` for production, after creating a Neon branch as a restore point.

## Consequences
Strong consistency and SQL for reporting. Migrations through the pooler fail (P1017), so the direct URL is required. Local development must not point at the production database (risk R1).
