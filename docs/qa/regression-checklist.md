# Regression checklist

Manual checks on the **Vercel preview** before merging anything that touches these areas, and the full list before a big release or a framework upgrade (Next.js, Prisma, NextAuth). Use a test student account and a test admin account on a Neon branch, never real students.

Mark each line ✅ / ❌ with a note. A ❌ blocks the merge unless it also fails on production (then log a bug).

## Smoke (every release, ~10 minutes, on a phone)
| # | Check | Expected |
|---|---|---|
| S1 | Open the home page signed out | Loads, free notes listed, no errors in the console |
| S2 | Sign in as the test student | Lands on the dashboard |
| S3 | Open a module → chapter → topic | Lesson renders (maths, code, images) |
| S4 | Start the topic quiz, answer all, finish | Marked per answer; results show score and pass/fail |
| S5 | Open the timetable, add an event | Saved and shown |
| S6 | Send a chat message | Arrives for the other test user in real time |
| S7 | Sign out | Back to the public site; app pages redirect to login |

## Accounts
| # | Check | Expected |
|---|---|---|
| A1 | Register a new email | 6-digit code emailed; account only after the code |
| A2 | Wrong code 5 times | Code stops working |
| A3 | Forgot password | Link arrives, expires after 1 hour, works once |
| A4 | Change name, email (code), password, picture | All saved; email needs the code |
| A5 | Student opens `/admin` | Redirected to the dashboard |

## Studying and quizzes
| # | Check | Expected |
|---|---|---|
| Q1 | Locked topic, previous quiz not passed | Lock message names the topic to pass |
| Q2 | Pass the previous quiz (≥ 70%) | Locked topic opens; results say it unlocked |
| Q3 | Refresh mid-quiz | Same attempt continues with answers kept |
| Q4 | Type-the-answer question | Accepts spacing variations; answer not visible in the browser's network tab before answering |
| Q5 | Chapter quiz and mock exam | Mock exam timed; auto-hands in at the limit; pass mark 50% |
| Q6 | Code exercise and project upload (coding module) | Exercise checked; project marked by AI or a clear error |
| Q7 | University vs high school account | Each sees only their level's modules/subjects and words |

## Notifications and reminders
| # | Check | Expected |
|---|---|---|
| N1 | Turn on notifications | Test push arrives |
| N2 | Event with a reminder 5 minutes ahead | Push arrives on time (production cron) |

## Public site and SEO
| # | Check | Expected |
|---|---|---|
| P1 | Published topic at `/notes/<id>` signed out | Readable; sample quiz shown |
| P2 | Unpublished topic at `/notes/<id>` | Not found |
| P3 | `/sitemap.xml`, `/robots.txt` | Load; only published topics listed |

## Admin
| # | Check | Expected |
|---|---|---|
| D1 | Create module → chapter → topic, write a lesson | Saved; renders for students |
| D2 | Generate questions with AI | Questions saved, or a readable error |
| D3 | Lock and publish a topic | Lock applies in the app; topic appears on `/notes` |
| D4 | `/admin/analytics` | Loads; numbers change after a test sign-up and quiz |
| D5 | Change a user's role (superuser only) | Allowed for superuser; refused for a normal admin |

## Automated regression (runs in CI on every PR)
`npm run lint`, `npm run typecheck`, `npm test` (unit + PGlite integration), `npm run build`. Every fixed bug adds a test here so it can't come back.
