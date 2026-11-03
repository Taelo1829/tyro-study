# Tyro Study: Security, compliance and specialist testing

*Phase 8 of the project lifecycle. Written 29 October 2026. The tests below were run, not only planned: the production build of Tyro ran locally against a real PostgreSQL 16 database created from all 22 migrations, with seeded test accounts and content. Three reusable test scripts were added to the repo so the same checks can run against a Vercel preview.*

> **Not legal advice.** The POPIA section summarises the Act and the Information Regulator's guidance as published; confirm the compliance actions with a South African privacy practitioner before relying on them.

---

## 1. Results at a glance

| Area | Result | Fixed in this phase | Still open |
|---|---|---|---|
| **Authentication and permissions** | 50 checks: **46 pass** (was 35 on first run) | Lesson-text leak through the topic list (3.2), malformed JSON crash, security headers, zoom | Sign-in rate limit, sign-up email enumeration, level separation by topic id |
| **Threat model** | STRIDE model for 6 assets and 5 threat actors (section 4) | – | Minors in chat, AI content integrity, account takeover |
| **Penetration testing** | Local black-box test of all ~120 API route/method pairs | As above | External pentest before payments or a large launch (5.3) |
| **Privacy (POPIA)** | 8 conditions reviewed (section 6) | Privacy Policy updated earlier for analytics | **Children's data (high school level) needs a competent person's consent**; Information Officer registration; breach procedure |
| **Performance and load** | 30 simultaneous students: 0 errors; quiz answer p95 304 ms; quiz finish p95 1.1 s (local) | – | Quiz finish runs 335 SQL statements for an 80-question exam (7.2) |
| **Accessibility** | 40 page × screen-size scans (WCAG 2.2 AA rules): 20 clean | Pinch-zoom unblocked on every page; profile picture input labelled | Small touch targets, 7 contrast issues, timetable day buttons |
| **Compatibility** | Chromium desktop + phone emulation pass, no layout overflow | – | Real Safari iOS, Firefox, Samsung Internet, low-end Android |
| **UAT** | Plan, scripts and sign-off (section 9) | – | First UAT at the end of milestone M1 (9–11 Dec 2026) |

---

## 2. Test environment

| Item | Setting |
|---|---|
| App | `next build --turbopack` + `next start` (production mode, so Secure cookies and production code paths) |
| Database | PostgreSQL 16, schema built by applying all 22 migrations in order (this also proves the migrations work from scratch) |
| Accounts | Student A, Student B, high school learner H, admin, superuser, plus 40 load-test students |
| Data | Module with an unlocked published topic (lesson contains `<script>`, `onerror` and `javascript:` payloads), a locked topic, a high school subject, B's private calendar event, quiz attempt and chat |
| Not available | Vercel, Neon, Pusher, Resend, OpenAI (placeholders). Numbers are a **baseline**, not production figures (section 7.3) |
| Browser | Chromium (desktop 1280 px, phone 390 px with touch). Firefox and WebKit couldn't be installed here |

**Scripts added (rerun them on a preview):**

| Script | Does |
|---|---|
| `scripts/qa/seed-test-data.mjs` | Creates the fixtures. Touches only its own rows; refuses non-local databases unless `QA_ALLOW_REMOTE=1` (for a Neon branch). Never production. |
| `scripts/qa/security-tests.mjs` | 50 black-box checks: auth, cookies, brute force, open redirect, every route signed out, every admin route as a student, IDOR between students, locks, quiz integrity, roles, mass assignment, SSRF, XSS, headers. Exits 1 on failure. |
| `scripts/qa/a11y-scan.mjs` | Playwright + axe-core (WCAG 2.2 A/AA) on 20 pages at phone and desktop width; also flags horizontal scrolling, blocked zoom, JS errors and pop-ups (XSS) |
| `scripts/qa/load-quiz.mjs` | Exam-rush simulation: N students start and finish a quiz at the same time |

```bash
# local example
npm run db:up && DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tyro_study node scripts/qa/seed-test-data.mjs
npm run build && npm start   # in another terminal
node scripts/qa/security-tests.mjs && node scripts/qa/a11y-scan.mjs && LOAD_USERS=30 node scripts/qa/load-quiz.mjs
```

`a11y-scan.mjs` needs `npm i -D axe-core playwright` (not added to `package.json` to keep installs light).

---

## 3. Authentication and permission testing

### 3.1 Results (final run)

| Area | Checks | Result |
|---|---|---|
| Sign-in for all 5 roles; wrong password refused | 6 | ✅ |
| Session cookie: HttpOnly, SameSite=Lax, Secure | 3 | ✅ |
| Open redirect via `callbackUrl` after sign-in | 1 | ✅ stays on the site |
| **Signed out:** 112 protected route/method pairs | 1 | ✅ all refuse (401/403/405) |
| **Student → admin:** 56 admin route/method pairs | 1 | ✅ all refuse |
| **IDOR (A → B):** read/answer B's quiz, edit/delete B's event, read B's progress, read/post/mark-read B's chat, subscribe to B's Pusher channels | 11 | ✅ all refused; B's data intact |
| Topic locks: open locked topic, start its quiz | 2 | ✅ 403 |
| Quiz integrity: answers not sent to the browser; client-sent `isCorrect` ignored | 3 | ✅ |
| Roles: admin can't change roles or self-grant superuser; superuser can't demote self; profile update can't set role (mass assignment) | 4 | ✅ |
| Input: oversized analytics event (413), SSRF push endpoint (400), malformed JSON (no 500) | 3 | ✅ |
| Cron: refused without secret, runs with it | 2 | ✅ |
| XSS: public note strips `<script>`, `onerror`, `javascript:`; no pop-up when the lesson renders in the app (a11y scan) | 2 | ✅ |
| Security headers: HSTS, CSP, nosniff, Referrer-Policy, no `X-Powered-By` | 5 | ✅ (after fix) |
| **Sign-in rate limiting** | 1 | ❌ 12 wrong passwords, none limited (TS-008) |
| **Sign-up reveals registered emails** ("Email already registered", 409) | 1 | ❌ |
| **High school learner can open a university topic by id** | 1 | ❌ (catalogue hides it; direct link works) |
| Forgot-password same answer for known/unknown emails | 1 | ⚠️ Fails here only because email sending is off locally; the code returns the same message when sending works |

### 3.2 Fixed: lesson text leaked through the topic list (high)

`GET /api/topics?chapterId=…` had **no auth check** and returned every topic's full lesson HTML and assignment brief, **including locked and unpublished topics**, to anyone on the internet. That bypassed topic locks, the publish switch for free notes, and sign-in. (Not personal data, but it's the content students sign up for.)

**Fix (`src/app/api/topics/route.ts`):** sign-in required; lesson text and assignments returned to admins only. Students read lessons through `/api/topics/[id]`, which enforces locks. Verified by two new checks in the test script.

### 3.3 Other fixes in this phase

| Fix | File |
|---|---|
| Security headers on every response: HSTS (2 years, preload), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy` (microphone for voice notes only), CSP `frame-ancestors/base-uri/object-src/form-action`; `X-Powered-By` removed | `next.config.ts` |
| Pinch-zoom allowed (removed `maximumScale: 1`, `userScalable: false`) | `src/app/layout.tsx` |
| Malformed JSON to the quiz API returns 400, not 500 | `src/app/api/quiz/attempt/route.tsx` |
| Profile picture input has an accessible label | `src/components/profile/profile-settings.tsx` |

The CSP deliberately doesn't restrict scripts or styles yet (AdSense, Pusher, YouTube and Next.js inline scripts would need a tested allowlist). Next step: a full policy as `Content-Security-Policy-Report-Only` for two weeks, then enforce.

---

## 4. Threat model (STRIDE)

```mermaid
flowchart LR
  subgraph Internet
    V[Visitor] ; S[Student] ; L[Learner under 18] ; A[Admin] ; X[Attacker]
  end
  subgraph Vercel[Vercel - trust boundary]
    APP[Next.js app<br/>pages + API]
  end
  DB[(Neon DB<br/>accounts, progress,<br/>chat, analytics)]
  BLOB[(Blob<br/>avatars, chat media,<br/>textbooks)]
  EXT[Pusher · Resend · OpenAI · AdSense]
  V & S & L & A & X -->|HTTPS| APP
  APP --> DB & BLOB & EXT
```

**Assets:** accounts and passwords; students' study data and chat; learners' (minors') data; lesson content and question banks (the product); admin/superuser powers; the service's availability and reputation.

**Actors:** curious student (cheating, seeing others' data); malicious outsider (account takeover, scraping, spam); compromised admin account; abusive chat user (harassment, answer sharing, grooming risk with minors); automated bots.

| STRIDE | Threat | Current controls | Status / action |
|---|---|---|---|
| **S**poofing | Password guessing / credential stuffing | bcrypt 12, HttpOnly Secure cookies | ❌ No rate limit → TS-008. Admin 2FA (A4) |
| Spoofing | Fake accounts and spam | Email OTP before account creation, OTP limits | ✅ |
| **T**ampering | Faking quiz scores / bypassing locks | Server-side marking; lock checks on topic, quiz, exercise, project | ✅ (topic-list bypass fixed) |
| Tampering | Stored XSS through lessons or chat | Sanitizer on render; React escaping in chat | ✅ Add a script CSP (3.3) |
| Tampering | Poisoned AI content (wrong answers) | Admin review | ⚠️ Draft/ready state, question reports (TS-026, TS-032) |
| **R**epudiation | "I didn't delete that" (admin actions) | – | ⚠️ Add an admin audit log (who changed roles, deleted content) |
| **I**nformation disclosure | Reading another student's data (IDOR) | Queries scoped by user; channel auth | ✅ 11 IDOR checks pass |
| Information disclosure | Content scraping | Sign-in required for app content | ✅ (after fix 3.2); public notes are public by design |
| Information disclosure | Email enumeration | Forgot-password generic | ⚠️ Sign-up reveals registered emails |
| Information disclosure | Public chat media URLs | Random paths | ⚠️ Private blobs (TS-046) |
| **D**enial of service | Event or message flooding | Size cap on events; OTP send limits | ⚠️ Rate limits on events/messages (SEC-2, BR-73) |
| Denial of service | Exam-rush load | Serverless scaling | ⚠️ Quiz finish queries (7.2); presence channel cap (R2) |
| **E**levation of privilege | Student → admin | Role checked in DB on admin routes; superuser rules | ✅ 56 checks pass |
| Elevation | Mass assignment on profile | Whitelisted fields | ✅ |
| Elevation | SSRF via push endpoints | Allowlist (phase 7) | ✅ |
| Safety (abuse) | Adults contacting minors in chat | Friend requests only | ❌ All-users directory shows learners to adults; fixed by module groups + moderation (ADR 0007) and level separation |

---

## 5. Penetration testing

### 5.1 What was done

A local black-box test using `scripts/qa/security-tests.mjs` (section 3) plus a source review of every route (phase 7). Covered: authentication, session handling, authorisation on every endpoint, IDOR, business-logic abuse (locks, scoring, roles), injection (SQL, XSS), SSRF, open redirect, mass assignment, input robustness and headers.

### 5.2 Not covered

Infrastructure (Vercel, Neon, DNS), the live site, Pusher channel abuse at scale, social engineering, mobile PWA storage, and denial-of-service limits. These need either the real environment or permission from the providers.

### 5.3 When to commission an external pentest

Tyro is a small free service, so a paid external test isn't warranted yet. Commission one (or a bug bounty) **before any of these**:
1. Taking payments (paid tier).
2. Launching group chats to high school learners.
3. Passing about 5,000 active students, or a partnership with a school or tutor organisation.

Until then: run the scripts on every release candidate, and add an OWASP ZAP baseline scan against the Vercel preview in CI (free).

---

## 6. Privacy and regulatory compliance

### 6.1 POPIA conditions

| Condition | What it asks | Tyro today | Action |
|---|---|---|---|
| 1. Accountability | Someone is responsible | Founder runs the service | **Register an Information Officer** (by default the head of the business) with the Information Regulator; the Regulator has been checking for unregistered officers through 2026 |
| 2. Processing limitation | Lawful, minimal, with a justification (consent, contract, legitimate interest) | Contract/consent at sign-up; analytics minimal | **Children: see 6.2** |
| 3. Purpose specification | Specific purposes; keep only as long as needed | Purposes in the Privacy Policy | Set retention periods: chat, analytics (24 months), inactive accounts |
| 4. Further processing | Compatible with the original purpose | Analytics and AI marking disclosed | Keep AI prompts free of names and emails |
| 5. Information quality | Accurate and up to date | Profile editing | ✅ |
| 6. Openness | Privacy notice; PAIA manual | Privacy Policy (updated 29 Oct) | Check whether Tyro must publish a **PAIA manual** or qualifies for the small private body exemption |
| 7. Security safeguards (s19) | Reasonable technical and organisational measures | Hashing, TLS, access control, headers, tests in this document | Rate limits, backups, error monitoring (Sprint 1–2). **Breach procedure (s22):** notify the Regulator and affected users as soon as reasonably possible after a compromise; write a one-page runbook |
| 8. Data subject participation | Access, correction, deletion | Email request; profile editing | Self-service deletion (TS-039) after fixing the FK cascades (TS-002) |
| s69 Direct marketing | Opt-in for electronic marketing | Only service messages (codes, reminders, chat) | Any future newsletter or promotion needs opt-in and an unsubscribe link |
| s72 Cross-border transfers | Adequate protection or consent | Providers outside SA, disclosed | Keep the list current; check data processing agreements (Vercel, Neon, Pusher, Resend, OpenAI) |

### 6.2 Children's personal information (high priority)

POPIA treats anyone **under 18** as a child. Processing a child's personal information is prohibited unless an exception applies, the main one being **the prior consent of a competent person** (a parent or legal guardian). Other exceptions (legal obligations, historical or statistical research, information the child made public with consent) don't fit an account on a study app. The Regulator can also authorise processing in the public interest with safeguards, by application.

Tyro's **high school level** is for Grade 11 and 12 learners, most of them under 18. Today a learner signs up alone, and their name, email, progress and chat messages are processed without a parent's or guardian's consent.

**Options, in order of effort:**
1. **Ask for date of birth (or "I'm 18 or older") at sign-up.** Under-18s get a parental consent step: the learner enters a parent or guardian's email; the parent confirms by link (reuse the OTP/email system). Until confirmed, the account can only read public notes. Record who consented and when.
2. Turn off chat for under-18s until module groups with moderation ship (also a safety measure).
3. Or pause the high school level until the consent flow exists.

Also: update the Privacy Policy section "Children" (it currently says the service isn't directed at children under 13, which doesn't match POPIA's under-18 rule or the high school offer).

### 6.3 Other rules to keep in view

| Area | Point |
|---|---|
| Advertising | Google requires a certified consent banner (CMP) for visitors from the EEA, UK and Switzerland. Use AdSense's own consent message for those regions. |
| Consumer Protection Act / ECT Act | Free service now. Before a paid tier: terms, cooling-off and cancellation rules, and the supplier information the ECT Act requires on the site. |
| Copyright | Lessons must be original explanations; textbook files stay private (already the design). |
| UNISA | Keep the independence statement; no assessment answers (Terms §Acceptable use; moderation in groups). |

---

## 7. Performance and load testing

### 7.1 Results (local baseline)

20 simultaneous connections for 15 seconds each:

| Endpoint | Requests/s | p50 | p90 | p99 | Errors |
|---|---|---|---|---|---|
| Home page `/` (signed out, DB query) | 107 | 175 ms | 231 ms | 350 ms | 0 |
| Public note `/notes/t1` | 63 | 295 ms | 397 ms | 745 ms | 0 |
| Dashboard (signed in) | 51 | 378 ms | 462 ms | 515 ms | 0 |
| `GET /api/modules` (signed in) | 178 | 107 ms | 145 ms | 214 ms | 0 |
| `GET /api/progress/modules` | 174 | 109 ms | 150 ms | 184 ms | 0 |

**Exam rush:** 30 students start a 25-question quiz and answer every question at the same time (750 answers):

| Step | p50 | p95 | Errors |
|---|---|---|---|
| Start quiz | 623 ms | 645 ms | 0 |
| Answer a question | 222 ms | 304 ms | 0 |
| Finish (last answer) | **1,121 ms** | **1,144 ms** | 0 |

### 7.2 Finding: finishing a quiz runs hundreds of queries

SQL statements counted with `pg_stat_statements` for the single request that finishes a quiz:

| Quiz size | Statements | Time locally |
|---|---|---|
| 10 questions | 67 | 65 ms |
| 25 questions | 135 | 99 ms |
| 80 questions (mock exam) | **335** | 232 ms |

Locally each query takes well under a millisecond. On Neon, every statement is a network round trip: at 5 ms that's about 1.7 s for a mock exam; if the Vercel functions and the database are in different regions (for example functions in Cape Town, database in us-east-1), it becomes many seconds and risks the time limit. **Fix:** batch the `user_answers` writes (one read, one `createMany`, one bulk update) — about 5 statements instead of 335 (phase 7 finding P1, backlog TS-053).

**Check now:** in Vercel → Settings → Functions, confirm the function region matches the Neon region (`us-east-1` = Vercel `iad1`).

### 7.3 Targets and next load test

| Metric | Target (NFR-01/02) | Local | Measure next |
|---|---|---|---|
| Quiz answer API p95 | ≤ 500 ms | 304 ms at 30 users | On a Vercel preview + Neon branch with `load-quiz.mjs`, 100 users |
| Pages LCP p75 on 4G | ≤ 2.5 s | – | Vercel Speed Insights on production |
| Errors under exam load | 0 | 0 | 100 and 300 users before May 2027 |

---

## 8. Accessibility and compatibility testing

### 8.1 Automated accessibility (axe-core, WCAG 2.2 A/AA)

20 pages × phone and desktop = 40 scans. **First run: all 40 failed** "meta-viewport" (zoom blocked). **After the fix: 20 scans clean**, no horizontal scrolling anywhere, no JavaScript errors.

| Issue | Where | Severity | Fix |
|---|---|---|---|
| ~~Zoom blocked~~ | ~~All pages~~ | ~~Critical~~ | **Fixed** |
| ~~File input without label~~ | ~~Profile~~ | ~~Critical~~ | **Fixed** |
| Touch targets under 24 px or too close | Public top nav links (4 per page), login/register fields next to their buttons, timetable day buttons (42 on phone), admin module links | Serious | Minimum 24×24 px with spacing (44 px for main actions, as the design system says); timetable days at least 32 px on phones |
| Text contrast too low | About and Privacy page links (7) | Serious | Use the ink colour or underline with a darker link colour (design doc §6 table) |

### 8.2 Manual accessibility checks still needed

Automated tools find about a third of problems. Before release of each milestone:
- **Keyboard only:** sign in, finish a quiz, add a timetable event, send a chat message, without a mouse; focus always visible.
- **Screen readers:** TalkBack (Android Chrome) and VoiceOver (iOS Safari) on sign-in, lesson, quiz question, feedback and results; NVDA on Windows for admin pages.
- **Zoom to 200% and text size "Large"** on a phone: nothing cut off or hidden behind the bottom nav.
- **Reduced motion:** animations respect the setting.

### 8.3 Compatibility

| Platform | Tested here | Needed |
|---|---|---|
| Chrome desktop (1280 px) | ✅ all pages load, no errors | – |
| Chrome Android (390 px emulation, touch) | ✅ no overflow, no errors | Real low-end Android (2–3 GB RAM) on a throttled 3G profile |
| Safari iOS | ❌ couldn't run here | **Real iPhone:** PWA install, push notifications (iOS 16.4+ and only after "Add to Home Screen"), voice notes, PDF download |
| Firefox desktop / Android | ❌ | Quick smoke test |
| Samsung Internet | ❌ | Smoke test (common in SA) |
| Edge desktop | Same engine as Chrome | Smoke test |

---

## 9. Business-user acceptance testing (UAT)

### 9.1 Who and when

| Role | People | Signs off |
|---|---|---|
| Students | 5 UNISA students (mixed modules and years, at least 2 working part-time) | Study, quiz, plan, chat flows |
| Learner and parent | 1–2 Grade 12 learners **with a parent or guardian's consent** | High school flows (after 6.2) |
| Content admin | Taelo + any helper | Content tools, publishing, moderation |
| Product owner | Taelo | Final go / no-go |

**Schedule:** at the end of each milestone, on the Vercel preview with a Neon branch: M1 → 9–11 Dec 2026; M2 → 1–4 Feb 2027; M3 → 1–3 Mar 2027; M4 (group chats) → 12–15 Apr 2027.

**Entry criteria:** CI green; security script passes; a11y scan has no critical issues; regression smoke test passes; test accounts and content ready.
**Exit criteria:** every UAT scenario passes or has an accepted workaround; no open S1/S2 defects; product owner signs off.

### 9.2 UAT scenarios (M1 and M2)

| # | Scenario (do it like a real student) | Expected | Story |
|---|---|---|---|
| U1 | Sign up with your own email and choose your level | Code arrives; account created; onboarding opens | US-01, US-02 |
| U2 | Pick your modules and set your next deadline | All modules joined in one step; deadline shows on Home | US-02 |
| U3 | From Home, continue studying | Opens the right next topic, never a locked one | US-03 |
| U4 | Read the lesson, then take the quiz | Lesson readable on your phone; quiz button always visible | US-05 |
| U5 | Get a question wrong | You see why, and a link back to the lesson | US-06 |
| U6 | Pass the quiz | Celebration; next topic unlocked | US-04, US-05 |
| U7 | Fail a quiz | Kind screen; topics to revise; streak kept | US-05 |
| U8 | Take the mock exam | Timed; handed in automatically at the limit | US-07 |
| U9 | Add a study session with a reminder | Reminder arrives on your phone | US-09 |
| U10 | Read a free note signed out (from a Google search) | Readable without an account; sample quiz works | US-08 |
| U11 (admin) | Create a topic from a textbook chapter, review it, publish it | Draft → reviewed → published; appears in /notes | US-11 |
| U12 (admin) | Check this week's numbers | `/admin/analytics` shows the UAT sign-ups and quizzes | US-12 |

### 9.3 Sign-off record (one per milestone)

| Field | |
|---|---|
| Milestone / release | |
| Preview URL and commit | |
| Testers and dates | |
| Scenarios passed / total | |
| Open defects (id, severity, decision) | |
| Decision | ☐ Go ☐ Go with conditions ☐ No go |
| Signed (product owner) and date | |

---

## 10. Release gate (security and compliance)

A release to production needs all of these:

- [ ] `security-tests.mjs` passes on the preview (known open items listed and accepted)
- [ ] No critical or high **production** dependency advisories without a decision (phase 7 §5)
- [ ] `a11y-scan.mjs` shows no critical violations; manual keyboard check done for changed screens
- [ ] Load test run if the release touches quizzes, chat or the dashboard
- [ ] Privacy impact considered: new personal data → Privacy Policy, retention and deletion updated
- [ ] UAT sign-off for milestone releases
- [ ] Rollback plan known (Vercel rollback; Neon branch before migrations)

---

## 11. To do now

1. **Commit this phase's fixes** (after the earlier branches):
   ```bash
   git switch -c fix/security-testing-findings
   git add next.config.ts src/app/layout.tsx src/app/api/topics/route.ts src/app/api/quiz/attempt/route.tsx \
     src/components/profile/profile-settings.tsx scripts/qa
   git commit -m "fix(security): require sign-in for topic list and hide lesson text from it" \
     -m "Locked and unpublished lessons were readable without signing in via GET /api/topics. Also: security headers, pinch-zoom allowed, 400 for malformed quiz JSON, labelled profile picture input, and reusable QA scripts (security, accessibility, load)."
   ```
2. **Decide the high school consent approach** (6.2): add a parental consent flow, switch off chat for under-18s, or pause the level.
3. **Register the Information Officer** with the Information Regulator and check the PAIA manual requirement.
4. **Confirm the Vercel function region** matches Neon (7.2).
5. **Add to the backlog:** TS-053 batch quiz-finish writes (P1); TS-054 parental consent for under-18s (P1); TS-055 generic sign-up response (P2); TS-056 admin audit log (P2); TS-057 touch-target and contrast fixes (P2); TS-058 report-only full CSP (P3); TS-059 real-device test pass on iPhone and low-end Android (P2).

---

Sources:
- [Information Regulator: Guidance note on processing personal information of children (Acts Online)](https://www.acts.co.za/popia-gn-children-2021/)
- [Information Regulator guidance note (Law Library)](https://lawlibrary.org.za/akn/za/doc/guidance-note/inforegsa/2021-06-01/guidance-note-on-processing-of-personal-information-of-children/eng@2021-06-01/source)
- [Registering an Information Officer (Trinico, reviewed June 2026)](https://trinico.co.za/help/register-information-officer/)
- [Information officer for POPI and PAIA (Michalsons)](https://www.michalsons.com/blog/information-officer/12231)
