# Tyro Study: Discovery and business analysis

*Phase 1 of the project lifecycle. Written 29 October 2026 from the current codebase, the live site (www.tyrostudy.co.za), the UX review in `docs/ux-review/`, and the privacy policy and terms.*

> **About this document.** Tyro Study is already built and live, so this is partly a look back: it writes down the reasons the product exists and checks whether they still hold. Anything that is an assumption rather than something we have measured is marked **(assumption)**. Those are the things to validate first.

---

## 1. The business problem

### Problem statement

> UNISA students study on their own, at a distance, often part-time around work and family, and many study in their second or third language. The official material (study guides, tutorial letters, prescribed textbooks) is long and dense, and there is no lecturer nearby to explain it, check understanding or keep the student on track. So students struggle to understand topics, can't tell whether they're ready for an assignment or exam, and drop off when motivation runs out.

### What that looks like for a student

| Pain point | What happens today |
|---|---|
| **Dense material, no one to ask** | The study guide and textbook are the only explanation. If a section doesn't make sense, the student is stuck until a tutor session, a forum reply or a WhatsApp group answer. |
| **Language barrier** | Academic English in a second or third language makes dense material harder still. |
| **No way to check readiness** | Past papers exist, but there's no quick, topic-by-topic check with instant marking, so students only find their weak areas in the exam. |
| **No structure or pacing** | Distance students plan their own semester. Without deadlines between assignments it's easy to fall behind and cram. |
| **Isolation** | Studying alone lowers motivation. Classmates are scattered across the country. |
| **Scattered tools** | Notes in PDFs, flashcards in one app, dates in another, classmates on WhatsApp. Nothing ties them to the module structure. |

### Why it matters

- **For students:** failed modules cost money and time (re-registration fees, a longer degree) and are demotivating.
- **For the business:** if Tyro can reliably help students pass, that is the reason they come back, recommend it to classmates and, later, pay for it.

### Secondary problem (newer market)

The codebase already supports a second study level, **high school (Grade 11 and 12, CAPS curriculum, NSC/matric exams)**, with the same app and different wording (subject/grade instead of module/course). The problem is similar: learners need clear explanations and practice beyond the classroom. The rest of this document focuses on UNISA, the core market, and notes where high school differs.

---

## 2. Users and stakeholders

### Primary users

| User | Who they are | What they need from Tyro |
|---|---|---|
| **UNISA student (core user)** | Distance learner, often working and part-time, studying on a phone, in their second or third language, careful with mobile data. Mostly adults. | Plain-English lessons per topic, quick quizzes that show what to revise, a plan, and a reason to study a little every day. |
| **High school learner (Grade 11–12)** | Teenager preparing for end-of-year or NSC exams, almost always on a phone. | CAPS-aligned notes and practice, exam readiness. |
| **Visitor (not signed in)** | Someone who found a free note through Google or a shared link. | Useful content straight away, with no sign-up needed, and a clear reason to create an account. |

### Internal users

| User | Role in the app | What they need |
|---|---|---|
| **Admin / content creator** (`Role.ADMIN`) | Builds modules, chapters and topics; uploads textbooks, PDFs and past papers; generates and edits lessons, questions, flashcards, exercises and projects with AI; publishes topics. | Fast, reliable content tools, because content is the product. |
| **Superuser** (`isSuperuser`) | Manages admins and roles. | Control over who can change content. |

### Stakeholders (affected but not daily users)

| Stakeholder | Interest / influence |
|---|---|
| **Founder / product owner (Taelo)** | Builds and runs the product and pays the running costs. Decides direction and priorities. |
| **Classmates and study groups** | Spread the app by word of mouth. Benefit from chat and shared progress. |
| **UNISA** | Not a partner. Tyro is independent and says so on the About and Terms pages. Its rules matter, though: **academic integrity** (no sharing assessment answers) and **trademark/IP** (module names, study-guide content). UNISA could object if Tyro reproduced its material or appeared to be official. |
| **Textbook publishers and authors** | Copyright holders of prescribed textbooks that admins upload and generate notes from. A legal risk if content gets too close to the original. |
| **Parents and schools** (high school) | Pay for or recommend study tools for minors. Care about safety, especially in chat. |
| **Information Regulator (POPIA)** | Personal data is stored, some of it outside South Africa (Vercel, Pusher, Resend, OpenAI). High school users may be minors, which raises the bar for consent. |
| **Google AdSense** | Current revenue source. Sets rules on which pages may show ads. |
| **Service providers** | Vercel (hosting, files), Neon/PostgreSQL (database), Pusher (real-time chat), Resend (email), OpenAI (AI content and marking). Their pricing and limits shape running costs. |

---

## 3. Business goals and success metrics

### Goals

| # | Goal | Why |
|---|---|---|
| G1 | **Help students pass their modules.** | The core value. Everything else depends on it. |
| G2 | **Turn sign-ups into regular learners.** | The UX review found students leave after one visit because the next step isn't clear. Retention is the current bottleneck, not features. |
| G3 | **Cover the modules students actually take.** | Content is the product. A student whose modules aren't on Tyro has no reason to join. |
| G4 | **Grow through search and word of mouth, at low cost.** | Free public notes bring in visitors from Google; chat, friends and shareable milestones bring in classmates. |
| G5 | **Cover running costs, then earn a profit.** | Hosting, AI and real-time chat cost money every month. AdSense is the start; a paid tier is the likely next step. |
| G6 | **Stay on the right side of UNISA, copyright and POPIA.** | A takedown, complaint or data breach could end the project. |

### Success metrics

Targets are starting points to revise once real data exists. Activation and return targets come from the UX review.

| Goal | Metric | How it's measured | Starting target |
|---|---|---|---|
| G2 | **Activation**: % of new sign-ups who pass their first topic quiz within 24 hours | `QuizAttempt` records against `User.createdAt` | 40%+ |
| G2 | **Day-1 / Day-7 return** | Sessions or study activity on the next day / within 7 days | 30% / 20%+ |
| G2 | **Weekly active learners**: students who finish at least one lesson or quiz a week (not just visits) | Quiz attempts and lesson completions | Rising week on week |
| G2 | **Funnel**: sign-up → module joined → lesson opened → quiz started → quiz passed | Event tracking (to be added) | Find and fix the biggest drop first |
| G1 | **Learning gain**: first-attempt score vs best score per topic | `QuizAttempt` history | Average gain of 15+ points |
| G1 | **Mock exam pass rate** for students who finished a module's topics | Mock exam attempts | 70%+ |
| G1 | **Self-reported module pass rate** | Short survey after exams | Higher than students' own previous results (assumption: needs a baseline) |
| G3 | **Module coverage**: published modules with every topic having a lesson and a quiz | `Module`, `Topic.published`, `Question` counts | Every module a user asks for in a semester |
| G3 | **Content quality**: wrong or reported questions per 1,000 answered | Reports (to be added) | Under 5 |
| G4 | **Organic traffic** to `/notes` and **visitor → sign-up conversion** | Analytics, Search Console | Conversion 3–5% |
| G4 | **Invites / shares** per active learner | Friend requests, shared milestone cards | Rising |
| G5 | **Cost per active learner** (hosting + AI + Pusher + email ÷ monthly active learners) | Provider invoices | Falling as users grow |
| G5 | **Revenue per active learner** (ads now, subscriptions later) | AdSense, payments | More than cost per learner |
| G6 | **Takedown requests, POPIA complaints, data incidents** | Inbox and logs | Zero |

**North-star metric:** *weekly active learners who pass at least one quiz.* It combines retention (G2) and learning (G1), and it moves before revenue does.

---

## 4. Existing systems and constraints

### What students use today (alternatives and competitors)

| Alternative | What it does well | Where it falls short for this user |
|---|---|---|
| **myUnisa** (official platform) with study guides, tutorial letters and forums | Official, free, authoritative | Dense, not interactive, little self-testing, no motivation loop |
| **Prescribed textbooks and past papers** | Full coverage, the real exam style | Long, expensive, no explanations or marking |
| **WhatsApp / Telegram study groups** | Free, social, quick answers | Unstructured, unreliable answers, easy to lose |
| **Private tutors and tutoring centres** | Personal explanation | Expensive, limited hours, not everywhere |
| **Notes-sharing sites** (e.g. Studocu) | Lots of student-made notes | Uneven quality, not tied to a study path, often paywalled |
| **General flashcard and quiz apps** (e.g. Quizlet, Anki) | Good at revision and spaced repetition | Students must make their own content; no UNISA module structure |
| **General AI chatbots** (e.g. ChatGPT) | Explain anything on demand | No structure or progress, can be confidently wrong, don't know the module's scope |
| **High school:** Siyavula, school past papers, extra classes | CAPS-aligned, some free | Mostly maths and science; less social and less personalised |

**Tyro's position:** the only option that combines **lessons per topic, quizzes with instant marking, an enforced study path (topic locks), progress, a mock exam, a timetable and chat with classmates**, all built around the **UNISA module structure**, written in plain South African English, and free to start.

### What Tyro already has (built system)

- **Stack:** Next.js 16 / React 19 / TypeScript PWA on Vercel; PostgreSQL via Prisma; NextAuth with email OTP verification; Pusher for real-time chat and presence; Web Push notifications; Resend email from `tyrostudy.co.za`; Vercel Blob file storage; OpenAI (default `gpt-4o-mini`) for content generation and assignment feedback; Google AdSense.
- **Student features:** modules → chapters → topics, lessons, PDFs, videos, quizzes, chapter quizzes, mock exams, flashcards, code exercises and projects, progress reports, streaks, a timetable with reminders, chat with friends (voice notes, replies), public free notes.
- **Admin features:** textbook upload and OCR, AI course import, AI lesson, question, flashcard, exercise and project generation, past-paper reading, video finder, Excel bulk import, topic lock and publish controls, user management.
- **Known product gaps** (from the UX review): no onboarding, "Up Next" can point at a locked topic, quiz Submit hidden on phones, no explanation per answer, the streak counts visits rather than study, and **no event tracking**, so most of the metrics above can't be measured yet.

### Constraints

| Type | Constraint | Impact |
|---|---|---|
| **Users** | Mostly mobile, often on limited or expensive data, sometimes older phones | Must be light, fast and work offline where possible (the PWA helps). Large PDFs and videos cost students money. |
| **Users** | Second- or third-language English speakers | Plain English everywhere (already in the AI prompts in `lib/ai/unisa.ts`). |
| **Users** | Price-sensitive (students) | Free core; any paid tier has to be cheap and clearly worth it. |
| **Team** | One developer, also working full-time and studying | Small, high-impact changes first; lean on automation and AI for content; avoid features that need constant moderation. |
| **Budget** | Self-funded; monthly costs for hosting, database, Pusher, OpenAI and email | Watch AI cost per generated topic and Pusher connection limits; cache AI output rather than generating per user. |
| **Content** | Content quality depends on AI plus human review; one person can only review so much | Risk of wrong answers. Needs a "report a problem" flow and review before publishing (the `Topic.published` flag is a start). |
| **Legal** | **Copyright:** notes are generated from prescribed textbooks and past papers | Notes must be original explanations, not copies. Don't publish uploaded textbook PDFs publicly. |
| **Legal** | **UNISA brand and integrity rules** | Stay clearly independent (already stated). No assessment answers. Avoid implying endorsement. |
| **Legal** | **POPIA:** personal data, chat content, voice notes; data stored outside SA; possible minors (high school) | Privacy policy exists. High school chat with adults needs safeguards, and parental consent should be considered for under-18s. |
| **Platform** | AdSense content rules (no ads on login, empty or navigation-only pages) | Ads only on lesson and notes pages, which limits ad revenue. |
| **Technical** | Vercel serverless time limits for long AI jobs (textbook analysis, bulk generation) | Long jobs need batching, background processing or retries (partly handled in `chatJson`). |
| **Calendar** | UNISA semesters and exam periods (roughly May/June and October/November) | Usage will spike before exams and drop between semesters. Content for a module has to be ready *before* its assignment and exam season. |

---

## 5. Is the project worth building?

**Recommendation: yes, keep building, but shift effort from new features to retention, measurement and content coverage, and test the business model before spending more.**

### For

1. **A real, large and lasting problem.** UNISA is one of the largest universities in Africa by enrolment *(figure to confirm)*, and its distance-learning model creates exactly the support gap Tyro fills. The high school market (Grade 11–12) adds a second, larger audience on the same codebase.
2. **The expensive part is done.** The app is live, with a full study loop, admin and AI content tools, chat and notifications. The marginal cost of the next improvement is small.
3. **Clear position.** No common alternative combines UNISA-structured content, self-testing with marking, an enforced path, progress and classmates in one place.
4. **Cheap to grow.** Free public notes bring search traffic; chat and friends give a word-of-mouth loop most study apps don't have.
5. **AI makes content scale.** One person can cover many modules with the generation pipeline, which would otherwise need a team of writers.
6. **Founder–market fit.** The founder is a UNISA student and the target user, so testing with real students and modules is easy.

### Against / risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Students try it once and don't return | High (seen in the UX review) | High | Do the UX review's quick wins and onboarding first; add event tracking to measure activation and return. |
| AI content contains mistakes that cost students marks | Medium | High | Human review before publishing, "report a problem" per question, explanation per answer, track reported-error rate. |
| Copyright complaint from a publisher, or objection from UNISA | Low–Medium | High | Original explanations only; no public textbook PDFs; clear independence statement; respond quickly to takedowns. |
| Running costs grow faster than revenue | Medium | Medium | Measure cost per learner; cache AI output; test a low-cost premium tier (e.g. mock exams, unlimited AI explanations, past-paper practice). |
| Ad revenue is small (few ad-eligible pages, low local ad rates) | High | Medium | Treat ads as a cost offset, not the business model. Validate willingness to pay early. |
| Founder capacity (job + studies + app) | High | High | Ruthless prioritisation: one goal per month; automate content; avoid features that need moderation. |
| Chat safety with minors (high school level) | Medium | High | Separate high school users from adults in chat, or turn chat off for under-18s; reporting and blocking. |

### Decision criteria to review in about 3 months (end of January 2027, before semester 1)

Continue investing if:

- Event tracking is live and **activation is 25%+** and rising toward 40%.
- **Day-7 return is 15%+.**
- At least **5 complete modules** have every topic with a lesson and a quiz, matching what users ask for.
- **Cost per active learner** is known, and a pricing test (e.g. a waitlist or an early paid tier) shows students would pay.

If activation and return stay low *after* the onboarding and quiz fixes, the problem is likely the content or the value offered, not the interface. Interview 10 students before building anything else.

### Immediate next steps

1. Add event tracking (Vercel Analytics custom events or PostHog) for the funnel in section 3.
2. Ship the UX review's "this week" quick wins (Up Next fix, quiz focus mode, Continue card, separate pass/fail results).
3. Interview 5–10 UNISA students (classmates in COS, MAT and INF modules) to confirm the pain points and ask what they would pay for.
4. List the modules users have joined or asked for, and plan content coverage for semester 1 2027.
5. Add a "report a problem" button to questions and lessons.
6. Decide on chat safety for high school users.
