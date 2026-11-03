# 0002 One Next.js app (modular monolith) on Vercel

- **Status:** Accepted
- **Date:** 2026-10-29 (records the existing choice)

## Context
Tyro needs public, indexable notes (SEO and AdSense), a signed-in study app, admin tools and an API. One developer, part-time. A separate React SPA with a .NET API was considered earlier.

## Decision
Keep one Next.js (App Router) application in TypeScript: pages, Server Components and Route Handlers in `src/app`, domain logic in `src/lib/<area>`, deployed to Vercel. No microservices. Route handlers stay thin (parse → authorise → call `lib` → respond); `lib` never imports from `app`.

Long-running work (AI generation, OCR) moves to a background job queue in the same code base when it outgrows request time limits (backlog TS-023), not to a separate service.

## Consequences
One repo, one deploy, shared types end to end, server rendering for public pages. Serverless limits apply (function duration, no long-lived sockets, so real time goes through Pusher). If a part ever needs its own scaling or runtime, the `lib` boundary makes it extractable.
