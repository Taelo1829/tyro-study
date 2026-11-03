# Runbook: incident response

**An incident** is anything that stops students studying, puts their data at risk, or will do soon if nobody acts. **Rule one: restore service first, find the cause second.** A rollback or a kill switch now beats a perfect fix in two hours.

## 1. Severity (decide in 2 minutes)

| Sev | What it looks like | Respond | Tell students |
|---|---|---|---|
| **SEV1** | Site or database down; sign-in broken; quizzes can't be answered or saved; wrong student's data shown; data lost; **any personal-data exposure** | Now (06:00–23:00); overnight alerts at the first chance in the morning | Within 30 min of starting |
| **SEV2** | A key feature broken for many, with a workaround: reminders not sent, sign-up codes not arriving, chat down, pages very slow (> 5 s) | Same day | If it lasts more than 1 hour |
| **SEV3** | Minor bug, few students, cosmetic, one error type repeating | Next normal release | No |

During exam weeks (UNISA Oct/Nov and May/Jun, matric Oct–Nov), raise SEV2s that block studying to SEV1.

## 2. Where alerts come from

| Source | Catches | Reaches you by |
|---|---|---|
| Uptime monitor (UptimeRobot free, every 5 min on `/api/health`) | Site or database down | Email (and its mobile app) |
| GitHub **Production monitor** (hourly) | Down, slow pages, reminders job stopped, error spikes | Issue labelled `incident` → GitHub email + mobile app |
| Daily ops email (06:00 SAST) | New error types, jobs late, slow real-user performance | Email |
| Admin → Monitoring | Everything above, on demand | You look |
| Students | Anything | Contact email, WhatsApp, socials |
| Vercel / Neon / Resend / OpenAI emails | Usage limits, outages, failed payments | Email |

## 3. Respond

1. **Acknowledge.** Comment on the `incident` issue (or open one: label `incident`, title `[SEV?] what's broken`). Note the time. Everything you do goes in that issue as you do it: it becomes the timeline.
2. **Scope (5 min).**
   - `https://www.tyrostudy.co.za/api/health`: up? which commit and migration?
   - Admin → Monitoring: new error groups, the route, the request id, scheduled jobs.
   - Was there a release or config change in the last 24 h? (GitHub releases, Vercel → Deployments, env var changes.)
   - Provider status: [Vercel](https://www.vercel-status.com), [Neon](https://neonstatus.com), Pusher, Resend, OpenAI status pages.
3. **Mitigate (choose the fastest that works):**

   | Situation | Do |
   |---|---|
   | Started after a release | **Vercel Instant Rollback** (docs/runbooks/rollback.md), then investigate |
   | A feature misbehaving (analytics, new sign-up level) | Kill switch: `FLAG_ANALYTICS=off`, `FLAG_HIGHSCHOOL_SIGNUP=off`, then redeploy (~2 min) |
   | Security headers break a page | `SECURITY_HEADERS=off`, redeploy |
   | Database down / limit reached | Neon console: compute status, usage; restart compute; check the plan's limits and billing emails |
   | Provider outage (Pusher, Resend, OpenAI) | Nothing to roll back: tell students what doesn't work; chat messages are still saved; codes can be re-requested later |
   | Abuse / flood | Vercel → Firewall: block the IP or path; Pusher / OpenAI: rotate keys if leaked |
   | Personal data exposed or wrong data shown | Roll back or take the feature offline **immediately**; then §6 |

4. **Communicate** (§5) for SEV1, and for SEV2 lasting an hour.
5. **Verify recovery:** health 200, the smoke test passes (`BASE_URL=https://www.tyrostudy.co.za node scripts/ci/smoke.mjs`), errors stop growing in Admin → Monitoring, a quick phone check of the broken flow.
6. **Recover affected data and jobs** (§4).
7. **Close:** remove the status banner, post the resolved message, write the review (§7). The monitor closes its own issues when checks pass; close manual ones yourself after the review.

## 4. Recovering affected services

| Affected | Recovery |
|---|---|
| **Study reminders** missed | The job only sends reminders up to **2 hours late**, then skips them (`MAX_LATE_MINUTES` in `src/lib/reminders.ts`) so nobody gets a 2 a.m. reminder for yesterday. After a longer outage, accept the missed ones and mention it in the resolved message. Check `cron:reminders` is green again in Admin → Monitoring |
| **Quizzes** interrupted | Answers are saved one by one; students can reopen the quiz. Timed mock exams that ran out during the outage: check `docs/release/monitoring.sql` query 4 (stuck attempts) and tell affected students they can retake |
| **Sign-up / reset codes** not delivered | Codes expire; students request a new one. Check Resend → Logs for bounces and the domain status |
| **Chat** (Pusher down) | Messages are stored in the database; they appear on refresh and live updates resume when Pusher is back |
| **Push notifications** | Subscriptions survive; nothing to do. Mass `410 Gone` errors mean expired subscriptions, which the app removes |
| **Data damaged** | docs/runbooks/rollback.md §4: Neon backup branch `pre-vX.Y.Z` or restore to a timestamp (Free plan: last 6 hours only, so act fast) |
| **Files** (Blob) | Vercel Blob has no undo: re-upload from the admin's copy |

## 5. Communicating with students

Channels, in order: the **in-app banner** (works if the site is up), the **WhatsApp groups and socials** where students follow Tyro, an **email** to affected students only for data incidents or anything that cost them work. Optional: the uptime monitor's free public status page (on the provider's own address; a custom domain like `status.tyrostudy.co.za` needs a paid plan).

**In-app banner:** Vercel → Settings → Environment Variables (Production) → `STATUS_MESSAGE` = the text (optional `STATUS_LEVEL=info`) → Deployments → Redeploy. Remove it and redeploy when resolved.

Templates (plain, honest, no blame, a time for the next update):

> **Started:** Tyro Study is having problems: [quizzes aren't saving / the site isn't loading / reminders are delayed]. Your progress so far is safe. We're working on it and will update you by [time].

> **Update:** Still working on [the problem]. [What works meanwhile, e.g. lessons and free notes open normally.] Next update by [time].

> **Resolved:** [The problem] is fixed as of [time]. [What students should do, e.g. reopen your quiz / request a new code / reminders between X and Y weren't sent.] Sorry for the disruption, and good luck with your exams.

## 6. Security and personal-data incidents (POPIA)

Treat as SEV1 even if the site works.
1. Contain: roll back, turn off the feature, rotate exposed keys (Vercel env vars, then redeploy).
2. Preserve evidence: copy the relevant log lines and error_events rows into the private incident issue before they expire (Vercel Hobby logs last 1 hour).
3. Assess: what information, how many students, since when, who could see it.
4. **Notify** the Information Regulator and the affected students **as soon as reasonably possible** after discovering the compromise (POPIA s22), with what happened, what information, what you've done, and what they can do. Get advice from a privacy practitioner (business/08 §6). The Information Officer (you) decides and keeps the record.
5. Use a **private** channel for details: don't put personal data in a public GitHub issue.

## 7. After the incident (within 3 days)

Copy `docs/incidents/TEMPLATE.md` to `docs/incidents/YYYY-MM-DD-short-name.md`, fill it in, link it from the issue. Blameless: what happened, why the system allowed it, what makes it less likely or less harmful next time. Each action becomes a backlog item; a production defect gets a regression test and a line in `docs/qa/regression-checklist.md` with the fix.

## 8. Fixing a production defect

1. Reproduce on staging (or locally with the request id, route and error message from Admin → Monitoring).
2. Write the failing test first where possible.
3. Fix on a branch. If `main` has unreleased work, branch from `production` (hotfix path in docs/runbooks/release.md).
4. Release as a patch version; check the error group stops growing; mark it **Resolved** in Admin → Monitoring (it reopens by itself if the error comes back).
