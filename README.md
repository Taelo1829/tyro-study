# Tyro Study

Study app for UNISA students (and Grade 11–12 learners): lessons in plain English, quizzes with instant marking, topic locks, mock exams, flashcards, a study timetable with reminders, and chat. Live at [www.tyrostudy.co.za](https://www.tyrostudy.co.za).

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Prisma 7 · PostgreSQL (Neon) · Vercel + Vercel Blob · Pusher · Web Push · Resend · OpenAI. Why: `docs/adr/`.

## Getting started

Needs Node 22+ and Docker.

```bash
npm install
cp .env.example .env.local      # fill in the keys you need
npm run db:up                   # local PostgreSQL in Docker
npx prisma migrate deploy       # create the tables
npm run db:seed                 # optional: admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
npm run dev                     # http://localhost:4000
```

Never point `.env.local` at the production database.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server on port 4000 |
| `npm run build` / `start` | Production build / serve |
| `npm test` / `test:watch` | Unit and integration tests (Vitest + PGlite) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run db:up` | Start the local database |
| `npm run db:migrate` | Create a migration from schema changes (local database only) |
| `npm run db:seed` | Create a local admin |

## Project layout

```
src/app          pages, layouts and API route handlers
src/lib          domain logic (quizzes, locks, progress, analytics, AI)
src/components   UI by area; shared UI in components/ui
src/prisma       generated Prisma client (committed)
prisma/          schema and migrations
test/            integration tests
docs/adr/        architecture decision records
business/        lifecycle documents: discovery, requirements, design, architecture, plan
```

## Contributing

Branching, coding standards, commit messages, secrets and tests: [CONTRIBUTING.md](CONTRIBUTING.md).

## Deploying

Merging to `main` deploys to staging. Production releases go through GitHub Actions → **Release to production** (`docs/runbooks/release.md`), which backs up and migrates the database, deploys, smoke-tests and tags the release. Rollback: `docs/runbooks/rollback.md`. Pipeline decisions: ADR 0010 and `business/09-ci-cd-and-deployment.md`.
