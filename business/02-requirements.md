# Tyro Study: Requirements

*Phase 2 of the project lifecycle. Written 29 October 2026 from the codebase, the UX review (`docs/ux-review/`) and the discovery document (`01-discovery-and-business-analysis.md`). Goal references (G1–G6) point to section 3 of the discovery document.*

> **How to read this.** Tyro is already live, so every requirement has a **status**:
> ✅ built · 🟡 partly built or has a known problem · ⬜ not built yet.
> **Priority** uses MoSCoW: **M**ust, **S**hould, **C**ould, **W**on't (for now).
> Numbers in the business rules (pass marks, limits, timeouts) are the values in the code today, with the file they live in, so a change to the rule means a change to that file.

---

## 1. Functional requirements

### 1.1 Accounts and sign-in

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-01 | A visitor can create an account with a name (optional), email, password and study level (high school or university). | M | ✅ |
| FR-02 | The account is only created after the visitor enters a 6-digit code emailed to them, so every account has a working email. | M | ✅ |
| FR-03 | A user can sign in with email and password. Emails are matched case-insensitively. | M | ✅ |
| FR-04 | A user can reset a forgotten password through an emailed link. | M | ✅ |
| FR-05 | A user can change their name, email (re-verified by code), password and profile picture. | S | ✅ |
| FR-06 | A user can sign out. | M | ✅ (🟡 Logout sits in the phone bottom nav and is easy to tap by mistake) |
| FR-07 | A user can delete their own account from the app. | S | ⬜ (today they must email; the Privacy Policy promises deletion on request) |

### 1.2 Finding and joining modules

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-10 | A student sees only modules (university) or subjects (high school) for their own study level. Admins see all. | M | ✅ |
| FR-11 | A student can browse modules grouped by course (qualification) or grade, and join or leave a module. Progress is kept when they leave. | M | ✅ |
| FR-12 | After sign-up, a new student is guided through a short onboarding: pick modules, set an exam or assignment date, choose a daily goal, then start the first lesson. | M | ⬜ (UX review §1) |
| FR-13 | A student can search modules by code (for example "MAT", "COS"). | S | ⬜ |

### 1.3 Studying a topic

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-20 | Each module is organised as chapters → topics. Each topic can have a lesson, video, PDFs, flashcards, a quiz, code exercises, a coding project and an assignment. | M | ✅ |
| FR-21 | Lessons render maths notation (subscripts, matrices, sums) and code correctly. | M | ✅ |
| FR-22 | A student can download a topic's notes as a PDF. | C | ✅ |
| FR-23 | The dashboard shows one clear "Continue" action that always points at the first **unlocked** topic whose quiz isn't passed yet. | M | 🟡 (today it can point at a locked topic; UX review §3) |
| FR-24 | A topic page shows reading time, quiz size and the steps Read → Cards → Quiz. | S | ⬜ (UX review §6) |
| FR-25 | A student can keep private notes in a notepad while studying (desktop). | C | ✅ |

### 1.4 Quizzes and exams

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-30 | A student can take a topic quiz, a chapter quiz and a module mock exam, drawn at random from the question pool. | M | ✅ |
| FR-31 | Answers are marked on the server, and the student sees right or wrong straight after each answer. | M | ✅ |
| FR-32 | After each answer the student sees a short explanation of why the right answer is right. | M | ⬜ (UX review §8) |
| FR-33 | If a student leaves or refreshes mid-quiz, they can carry on with the same attempt. | M | ✅ |
| FR-34 | The results screen shows score, pass or fail, time taken, a review of every question, notes on missed topics, and the next step (the next topic, and whether it's unlocked). | M | ✅ (🟡 pass and fail look the same; UX review §9) |
| FR-35 | During a quiz on a phone, the bottom navigation is hidden and the "Check answer" button is always visible. | M | 🟡 (Submit is hidden behind the nav; UX review §7) |
| FR-36 | A student has a scratch pad during quizzes. | C | ✅ |
| FR-37 | A student can report a wrong or unclear question. | S | ⬜ |
| FR-38 | Type-the-answer (fill in the blank) questions are supported alongside multiple choice. | S | ✅ |

### 1.5 Practice beyond quizzes

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-40 | A student can study flashcards for a topic. | S | ✅ |
| FR-41 | Flashcards use spaced repetition (a daily "cards due" review). | S | ⬜ (UX review §10–11) |
| FR-42 | In coding modules a student can do "Try it yourself" code exercises (fill in the blanks), checked instantly. | S | ✅ |
| FR-43 | A student can upload code for a coding project and get AI marks and feedback against a rubric. | S | ✅ |
| FR-44 | A student can upload an assignment and get AI feedback. | C | ✅ |

### 1.6 Progress, motivation and planning

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-50 | A student can see progress per module: topics and chapters passed, quizzes taken and failed, time spent. | M | ✅ |
| FR-51 | A student has a daily study streak. | S | 🟡 (counts any visit, not study; UX review §11) |
| FR-52 | A student can plan study sessions, assignment due dates and exams in a timetable and get push reminders. | S | ✅ |
| FR-53 | A daily goal (Read → Cards → Quiz) sized to the student's chosen minutes. | C | ⬜ |
| FR-54 | Topic locks: an admin can lock a topic so it opens only after the previous topic's quiz is passed. | M | ✅ |

### 1.7 Social

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-60 | A student can send and accept friend requests. Accepting opens a chat. | S | ✅ |
| FR-61 | Friends can chat in real time with text, images and voice notes, reply to a message, and see typing and online status. | S | ✅ |
| FR-62 | A student gets a push notification for new messages. | S | ✅ |
| FR-63 | A student can block or report another user. | M | ⬜ (needed before high school users mix with adults) |

### 1.8 Public site

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-70 | Published lessons are readable at `/notes/...` without an account, searchable, listed by module, and included in the sitemap. | M | ✅ |
| FR-71 | Public lessons show a short sample quiz and an invitation to sign up. | S | ✅ |
| FR-72 | Public pages carry About, Privacy and Terms pages and show AdSense ads only on content pages. | M | ✅ |

### 1.9 Content management (admins)

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-80 | An admin can create and edit courses, modules, chapters and topics, and order them. | M | ✅ |
| FR-81 | An admin can upload a textbook PDF (with OCR for scanned pages) and have AI propose a chapter and topic structure and draft lessons. | M | ✅ |
| FR-82 | An admin can generate, write, import (Excel template) and move quiz questions and flashcards. | M | ✅ |
| FR-83 | An admin can read a past paper and save its questions, labelled with the paper name. | S | ✅ |
| FR-84 | An admin can generate code exercises and coding projects with AI, and find a video for a topic. | S | ✅ |
| FR-85 | An admin can lock or unlock a topic, and publish or unpublish it as a public note. | M | ✅ |
| FR-86 | An admin reviews AI-generated content before students see it. | M | 🟡 (publishing controls the public site only; content inside the app is visible to students as soon as it is saved) |

### 1.10 Administration and analytics

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-90 | An admin can list, search and view users and their progress, and reset a user's password. | M | ✅ |
| FR-91 | A superuser can change roles, grant or remove superuser, and delete admin accounts. | M | ✅ |
| FR-92 | The app records product events (sign-up, module joined, lesson opened, quiz started and completed, page views and more). | M | ✅ (added 29 Oct 2026) |
| FR-93 | An admin can see activation, Day-1 and Day-7 return, weekly active learners, the new student funnel, quiz results, top pages and traffic sources. | M | ✅ (`/admin/analytics`) |

---

## 2. Non-functional requirements

Targets are what Tyro should meet. "Measured?" says whether there is a way to check it today.

### 2.1 Performance

| ID | Requirement | Target | Measured? |
|---|---|---|---|
| NFR-01 | Pages load fast on a mid-range Android phone on 4G. | Largest Contentful Paint ≤ 2.5 s at the 75th percentile | ⬜ (add Vercel Speed Insights) |
| NFR-02 | Quiz answers are marked quickly. | Answer API ≤ 500 ms at the 95th percentile | ⬜ |
| NFR-03 | No plain-text "Loading…" screens longer than 1 s; show skeletons instead. | 0 plain loading screens | 🟡 (UX review §10) |
| NFR-04 | Pages are light on mobile data. | First load of a lesson ≤ 500 KB excluding video and PDFs | ⬜ |
| NFR-05 | Long AI jobs (textbook analysis, bulk generation) don't time out. | Run within the 120 s function limit or in batches with retries | 🟡 |

### 2.2 Availability and reliability

| ID | Requirement | Target |
|---|---|---|
| NFR-10 | The app is available, especially in exam seasons (May–June, October–November). | 99.5% monthly uptime |
| NFR-11 | A failure in a side service (Pusher, web push, analytics, email) never breaks the main action. A sent message is still saved; a quiz is still marked. | ✅ already designed this way |
| NFR-12 | A student never loses quiz progress to a refresh, a dropped connection or a timeout. | ✅ resume attempt; ⬜ offline answer queue |
| NFR-13 | The database is backed up and can be restored. | Daily backups, restore tested once per semester (Neon point-in-time restore) |
| NFR-14 | Migrations are safe on the live database. | Run with `prisma migrate deploy` over the direct (non-pooled) connection; never `migrate dev` against production |

### 2.3 Security

| ID | Requirement | Status |
|---|---|---|
| NFR-20 | Passwords are hashed with bcrypt (cost 12). Minimum length 8. | ✅ |
| NFR-21 | Sign-in uses an httpOnly, SameSite=Lax session cookie, Secure in production. | ✅ |
| NFR-22 | Every API checks the session on the server. Admin APIs check the ADMIN role in the database, not only the token. | ✅ |
| NFR-23 | Quiz scores can't be faked from the browser: correctness is worked out on the server, and right answers to type-the-answer questions are never sent to the browser. | ✅ |
| NFR-24 | Uploads are checked for type and size (see BR-40 to BR-43). Rich text from admins is sanitised before display. | ✅ |
| NFR-25 | Email codes and reset links expire and are rate-limited (see BR-03 to BR-06). | ✅ |
| NFR-26 | Secrets live only in environment variables, never in the repository. | ✅ (`.env*` is git-ignored) |
| NFR-27 | Sign-in attempts are rate-limited per account and IP. | ⬜ |
| NFR-28 | The cron endpoint requires `CRON_SECRET`. | ✅ |

### 2.4 Privacy and compliance

| ID | Requirement | Status |
|---|---|---|
| NFR-30 | Processing follows POPIA. The Privacy Policy lists what is collected, the service providers and users' rights. | ✅ (updated 29 Oct 2026 for analytics) |
| NFR-31 | Analytics events store ids, scores and paths only: no names, emails, message text or query strings. They are deleted with the user. | ✅ |
| NFR-32 | A user can see, correct and delete their data. | 🟡 (by email; see FR-07) |
| NFR-33 | Users under 18 (high school) get safer defaults: not shown in the adult user directory, and chat only with approved friends at the same level. | ⬜ |
| NFR-34 | Tyro clearly states it is independent of UNISA, and lessons are original explanations, not copies of textbooks. | ✅ statement; 🟡 content review |

### 2.5 Accessibility

Target: **WCAG 2.2 level AA** on student-facing pages.

| ID | Requirement | Status |
|---|---|---|
| NFR-40 | Users can zoom the page. | 🟡 **Fails today**: the viewport sets `maximumScale: 1` and `userScalable: false` in `src/app/layout.tsx`, which blocks pinch-zoom (WCAG 1.4.4). Remove both. |
| NFR-41 | Text contrast is at least 4.5:1 (3:1 for large text). Locked topics shown at 55% opacity need checking. | ⬜ audit |
| NFR-42 | Everything works with a keyboard, with visible focus, including quiz options and dialogs. | ⬜ audit |
| NFR-43 | Right and wrong answers are shown with an icon and text, not colour alone. | 🟡 |
| NFR-44 | Touch targets are at least 44 × 44 px. Nothing important is covered by fixed bars. | 🟡 (quiz Submit button) |
| NFR-45 | Plain English for second- and third-language readers; South African spelling. | ✅ (built into the AI prompts) |
| NFR-46 | Use the app's toasts and dialogs instead of browser `alert()` and `confirm()`. | 🟡 (7 places; UX review §10) |

### 2.6 Compatibility and maintainability

| ID | Requirement |
|---|---|
| NFR-50 | Works on the last two versions of Chrome (Android and desktop), Safari (iOS) and Edge, from 360 px wide, and installs as a PWA. |
| NFR-51 | TypeScript strict mode; `npm run build` and `eslint` pass before every deploy. |
| NFR-52 | New database columns are added by migration, and code that reads a new column falls back safely if the migration hasn't run (the `orFallback` pattern). |
| NFR-53 | AI cost is kept under control: content is generated once by admins and cached, never per student view. Student-triggered AI (project and assignment marking) is limited per day. |

---

## 3. User stories and acceptance criteria

Acceptance criteria use *Given / When / Then* so each one can become a test.

### US-01 Sign up with a verified email (FR-01, FR-02) ✅
*As a UNISA student, I want to create an account quickly, so that I can start studying.*
- **Given** I enter a valid email, a password of 8+ characters and my study level, **when** I submit, **then** a 6-digit code is emailed to me and no account exists yet.
- **Given** I enter the right code within 10 minutes, **then** my account is created and I am signed in.
- **Given** I enter a wrong code 5 times, **then** the code stops working and I must request a new one.
- **Given** the email already has an account, **then** I see "Email already registered" and can go to sign in.

### US-02 First session onboarding (FR-12) ⬜
*As a new student, I want to be guided to my first lesson, so that I don't have to work out what to do.*
- **Given** I have just signed up, **when** I land in the app, **then** I see the onboarding instead of an empty dashboard.
- **When** I tick one or more modules and press Continue, **then** I am enrolled in all of them in one step.
- **When** I finish or skip, **then** I go straight to the first topic of my first module, and onboarding never shows again (`onboardedAt` is set).
- **Then** the `sign_up → module_joined → lesson_opened` funnel shows the improvement on `/admin/analytics`.

### US-03 Continue where I left off (FR-23) 🟡
*As a student, I want one button that takes me to my next step, so that I can study in a few spare minutes.*
- **Given** I have joined modules, **then** the top of the dashboard shows the next topic: the first unlocked topic, in module → chapter → topic order, whose quiz I haven't passed.
- **Then** that topic is never locked for me.
- **Given** I have passed every topic, **then** it suggests the chapter quiz or mock exam instead.

### US-04 Topic locks (FR-54) ✅
*As an admin, I want students to work through topics in order, so that they build on what came before.*
- **Given** a topic is locked and I haven't scored 70%+ on the previous topic's quiz, **when** I open it or start its quiz, **then** I see which topic to pass first.
- **Given** the previous topic has no questions, **then** the lock doesn't apply.
- **Given** I am an admin, **then** locks never apply to me.

### US-05 Take a topic quiz (FR-30, FR-31, FR-33, FR-34) ✅
*As a student, I want to test myself on a topic, so that I know whether I understand it.*
- **When** I start a topic quiz, **then** I get up to 20 random questions with options in random order.
- **When** I answer, **then** I see straight away whether I was right, marked by the server.
- **Given** I refresh mid-quiz, **then** I continue the same attempt with my answers kept.
- **When** I finish, **then** I see my score, pass or fail (pass mark 70%), the time taken and a review of every question.
- **Given** I pass, **then** the next locked topic opens for me and the results screen says so.

### US-06 Learn from mistakes (FR-32) ⬜
*As a student, I want to know why my answer was wrong, so that I learn instead of guessing.*
- **When** I answer a question, **then** a short explanation appears (two lines at most) with a link to the matching part of the lesson.
- **Given** a question has no stored explanation, **then** the quiz still works and shows the right answer only.

### US-07 Mock exam (FR-30) ✅
*As a student, I want a timed practice exam, so that I can check I'm ready.*
- **Given** the module has chapters with questions, **then** the mock exam takes each chapter's share of questions, past-paper questions I haven't seen in a mock first.
- **Then** the time limit is my usual pace for those questions, rounded up to whole 5 minutes, at least 10 minutes and at most 3 hours.
- **Given** time runs out, **then** the exam is handed in automatically and unanswered questions count as wrong.
- **Then** the pass mark is 50%.

### US-08 Free study notes (FR-70, FR-71) ✅
*As a visitor from Google, I want to read a lesson without signing up, so that I can decide whether Tyro is useful.*
- **Given** a topic is published and has a lesson, **then** it is readable at `/notes/<id>` without an account and appears in the sitemap.
- **Given** a topic is not published, **then** `/notes/<id>` shows "not found".
- **Then** the page shows a short sample quiz and a "create a free account" call to action.

### US-09 Plan and get reminders (FR-52) ✅
*As a working student, I want reminders for study sessions and due dates, so that I don't fall behind.*
- **When** I add an event with a reminder and have notifications on, **then** I get a push notification at the reminder time.
- **Given** the reminder system was down and a reminder is more than 2 hours late, **then** it is skipped rather than sent late.

### US-10 Chat with classmates (FR-60, FR-61) ✅
*As a student, I want to chat with classmates on the same module, so that studying feels less lonely.*
- **Given** someone accepts my friend request, **then** a conversation opens for both of us.
- **When** I send a message, **then** it is saved and shown to my friend in real time; if real-time delivery fails, the message is still saved.
- **Then** images are at most 5 MB and voice notes at most 10 MB.

### US-11 Publish AI content safely (FR-81, FR-85, FR-86) 🟡
*As an admin, I want to generate lessons with AI and check them before students rely on them.*
- **When** I generate a lesson from a textbook, **then** it is saved as a draft I can edit.
- **Given** a topic isn't published, **then** it doesn't appear on the public site.
- ⬜ **Given** a topic isn't marked ready, **then** students in the app don't see it either (needs a "ready for students" state).

### US-12 Track product health (FR-92, FR-93) ✅
*As the product owner, I want to see whether new students activate and return, so that I know what to fix.*
- **When** I open `/admin/analytics`, **then** I see activation, Day-1 and Day-7 return and weekly active learners against their targets, for the last 7, 30 or 90 days.
- **Then** admin activity is excluded and days are counted in South African time.
- **Given** the analytics migration hasn't run, **then** the page explains how to run it instead of crashing.

---

## 4. Permissions and business rules

### 4.1 Roles and permissions

| Action | Visitor | Student | Admin | Superuser |
|---|:-:|:-:|:-:|:-:|
| Read published notes, sample quiz, About/Privacy/Terms | ✓ | ✓ | ✓ | ✓ |
| Join modules of their level, study, take quizzes | – | ✓ | ✓ (all levels) | ✓ |
| Open locked topics without passing | – | – | ✓ | ✓ |
| Chat, friends, timetable, profile | – | ✓ | ✓ | ✓ |
| Create, edit, generate and delete content; lock and publish topics | – | – | ✓ | ✓ |
| View users and their progress; reset a user's password | – | – | ✓ | ✓ |
| View `/admin/analytics` | – | – | ✓ | ✓ |
| Change roles (student ↔ admin) | – | – | only if no superuser exists | ✓ |
| Grant or remove superuser; delete admin accounts | – | – | – | ✓ |

### 4.2 Business rules

| ID | Rule | Value | Where |
|---|---|---|---|
| BR-01 | One account per email, matched case-insensitively. | – | register routes, migration `one_account_per_email` |
| BR-02 | Password length | 8–200 characters | `lib/profile.ts` |
| BR-03 | Email code expiry | 10 minutes | `lib/email-otp.ts` |
| BR-04 | Wrong code attempts before the code is void | 5 | `lib/email-otp.ts` |
| BR-05 | Wait before resending a code; sends per hour | 60 s; 5 per hour | `lib/email-otp.ts` |
| BR-06 | Password reset link expiry | 1 hour | `lib/password-reset.ts` |
| BR-07 | Name length | up to 60 characters | `lib/profile.ts` |
| BR-10 | Study level decides which modules a student sees: high school = Grade 11–12 CAPS subjects; university = UNISA modules. | – | `lib/levels.ts` |
| BR-20 | Topic quiz pass mark; this also unlocks the next locked topic | 70% | `lib/topic-locks.ts` |
| BR-21 | Topic and chapter quiz size | up to 20 questions | `lib/quiz-stats.ts` |
| BR-22 | Mock exam pass mark | 50% | `lib/quiz-stats.ts` |
| BR-23 | Mock exam time limit | own pace × questions, whole 5 min, 10 min to 3 h | `lib/quiz-stats.ts` |
| BR-24 | Grace period for answers after a time limit | 2 minutes | `api/quiz/attempt` |
| BR-25 | Unanswered questions at the end count as wrong. | – | `api/quiz/attempt` |
| BR-26 | A lock is ignored when the previous topic has no questions. | – | `lib/topic-locks.ts` |
| BR-30 | Coding project pass mark | 50% | `lib/coding-shared.ts` |
| BR-31 | Project submissions per project per day | 10 | `lib/coding-shared.ts` |
| BR-32 | Assignment feedback pass mark | 60% | `api/assignment/grade` |
| BR-40 | Project upload: files, size per file, total | 10 files, 100 KB, 300 KB | `lib/coding-shared.ts` |
| BR-41 | Assignment upload size | 50,000 characters | `api/assignment/grade` |
| BR-42 | Chat image / voice note size | 5 MB / 10 MB | `api/chat/upload` |
| BR-43 | Profile picture size | 4 MB | `api/profile/avatar` |
| BR-50 | Streak: days counted in South African time; +1 for the day after the last visit, reset to 1 after a missed day. | – | `lib/streak.ts` (should count study, not visits) |
| BR-51 | Reminders more than 2 hours late are skipped. | 120 min | `lib/reminders.ts` |
| BR-60 | A topic is public only when published **and** it has a written lesson. Locks don't apply on the public site. | – | `lib/topic-publish.ts`, `lib/public-notes.ts` |
| BR-61 | Ads only on pages with real content, never on sign-in, empty or navigation-only pages. | – | `components/ads/adsense-script.tsx` |
| BR-70 | There must always be at least one admin and one superuser. Nobody can remove their own admin access or delete themselves from the admin pages. | – | `api/admin/users/[id]` |
| BR-71 | Students can't be superusers. | – | `api/admin/users/[id]` |
| BR-80 | Admin activity is excluded from analytics. Event props never hold personal details. | – | `lib/analytics-report.ts`, `lib/analytics-shared.ts` |

---

## 5. Dependencies and edge cases

### 5.1 External dependencies

| Dependency | Used for | If it fails | Mitigation |
|---|---|---|---|
| **Vercel** | Hosting, serverless functions, Blob file storage, cron | Whole app down | Status monitoring; keep the database portable |
| **Neon (PostgreSQL)** | All data | Whole app down | Pooled URL for the app, direct URL for migrations; backups (NFR-13) |
| **Pusher** | Real-time chat, typing, presence | Messages arrive on refresh instead of instantly | Messages are saved first (NFR-11) |
| **Web Push (VAPID)** | Message and reminder notifications | No notifications | Non-blocking; in-app unread counts still work |
| **Resend** (`tyrostudy.co.za`) | Sign-up codes, email changes, password resets | **Nobody can sign up or reset a password** | Monitor delivery; show a clear error and a retry |
| **OpenAI** (`gpt-4o-mini` by default) | Admin content generation; project and assignment marking | Admins can't generate; students can't get AI marks | Retries with valid-JSON checks (`chatJson`); clear "try again" messages; daily limits |
| **YouTube Data API** | Finding videos for topics | Admin video finder unavailable | Admin-only, non-blocking |
| **Google AdSense** | Revenue | No ad income | App unaffected |
| **UNISA calendar** | Timing of content and features | Content not ready before exams | Plan content per semester |

### 5.2 Internal dependencies (build order)

- **Onboarding (FR-12)** depends on the module search (FR-13) and the corrected "Continue" logic (FR-23).
- **Explanations (FR-32)** depend on an `explanation` field on questions and a batch AI job to fill it.
- **Study streak (FR-51) and daily goal (FR-53)** depend on the lesson-completed and quiz-passed events (now recorded by FR-92).
- **High school safety (NFR-33, FR-63)** must ship before the high school level is promoted.
- **Measuring any of the above** depends on the analytics migration being applied in production.

### 5.3 Edge cases

| # | Situation | Expected behaviour | Status |
|---|---|---|---|
| E-01 | Two sign-ups with the same email finish at the same moment. | The second gets "Email already registered. Try signing in." | ✅ |
| E-02 | The sign-up email never arrives (spam, typo, Resend down). | Resend after 60 s, up to 5 per hour; a clear message to check spam or the address. | ✅ / 🟡 wording |
| E-03 | A student refreshes, loses signal or closes the tab mid-quiz. | Same attempt resumes; older unfinished attempts of the same quiz are marked abandoned. | ✅ |
| E-04 | A timed exam's time runs out while the student is offline. | Answers after time + 2 min grace aren't accepted; the attempt finishes with unanswered = wrong. | ✅ |
| E-05 | An admin edits or deletes a question while a student has it in an open quiz. | The attempt keeps its own copy of the questions and finishes normally. | ✅ (questions are copied into the attempt) |
| E-06 | A module has fewer questions than the quiz size. | The quiz uses all available questions. | ✅ |
| E-07 | A module has no questions at all. | No mock exam is offered; the quiz button explains there are no questions yet. | ✅ / 🟡 wording |
| E-08 | The previous topic of a locked topic has no questions. | The lock is ignored, so students are never stuck. | ✅ |
| E-09 | "Up next" picks a locked topic. | Must never happen (US-03). | 🟡 bug |
| E-10 | Every topic in a chapter is locked but the chapter quiz is offered. | The chapter quiz should open only when its topics are passed, or be clearly labelled. | 🟡 (UX review §4) |
| E-11 | A student switches study level (university ↔ high school). | They keep joined modules and progress but only see the new level's catalogue. | ⬜ confirm and test |
| E-12 | A student leaves a module and rejoins. | Progress and quiz history come back. | ✅ |
| E-13 | Days around midnight, South African time. | Streaks, reminders and analytics days use Africa/Johannesburg; stored times are UTC. | ✅ |
| E-14 | AI returns broken or cut-off JSON. | Retried up to 3 times, then a readable error; nothing half-saved. | ✅ |
| E-15 | A scanned textbook PDF with no text layer. | OCR fallback. | ✅ |
| E-16 | A huge or wrong file type is uploaded. | Rejected with the limit in the message (BR-40 to BR-43). | ✅ |
| E-17 | Real-time chat service is down. | Message saved and returned; shown on next load. | ✅ |
| E-18 | A student under 18 appears in the user directory used by adults. | Should be hidden from adults (NFR-33). | ⬜ risk |
| E-19 | A user asks for their account to be deleted. | Account, study activity, chats and analytics events are deleted (cascade). | 🟡 manual, by email |
| E-20 | Exam-season traffic spike. | Pooled database connections; content pages cached; AI never called per student view. | 🟡 load test before May 2027 |
| E-21 | A visitor blocks cookies. | Public notes still work; sign-in needs the session cookie; analytics loses the visitor ID only. | ✅ |
| E-22 | A migration hasn't run in production yet. | Features that need it fall back quietly instead of breaking pages. | ✅ (`orFallback`, analytics) |

---

## 6. Open questions

1. **High school chat:** turn chat off for under-18s, or allow it only between high school users who are friends?
2. **Content review:** should AI-generated topics need an explicit "ready for students" step inside the app, like publishing does for the public site?
3. **Self-service account deletion:** build it now (POPIA right to deletion), or keep handling it by email?
4. **Paid tier:** which features, if any, would sit behind a subscription (mock exams, unlimited AI marking, past-paper practice)? This changes FR-30, FR-43 and the permission table.
5. **Accessibility:** fix the zoom block (NFR-40) straight away? It's a two-line change.

---

## 7. Traceability to business goals

| Goal (discovery doc) | Requirements |
|---|---|
| G1 Help students pass | FR-20–FR-38, FR-40–FR-44, FR-54, US-05–US-07 |
| G2 Turn sign-ups into regular learners | FR-12, FR-23, FR-24, FR-35, FR-41, FR-51–FR-53, US-02, US-03, US-06 |
| G3 Cover the modules students take | FR-80–FR-86, US-11 |
| G4 Grow through search and word of mouth | FR-60–FR-62, FR-70–FR-72, US-08, US-10 |
| G5 Cover running costs | FR-72, NFR-53, BR-31, BR-61 |
| G6 Stay compliant | NFR-20–NFR-34, FR-07, FR-63, BR-60, BR-80 |
| Measurement of all goals | FR-92, FR-93, US-12 |
