# Monthly product and maintenance review: <Month YYYY>

*First Monday of the month, 60 minutes. Copy to `docs/reviews/YYYY-MM.md`. Inputs: Admin → Analytics (30 days), Admin → Monitoring, Admin → Feedback, `npm audit`, `docs/tech-debt.md`, last month's review.*

## 1. Product metrics (Admin → Analytics, last 30 days vs previous 30)

| Metric | Definition | This month | Last month | Target | Note |
|---|---|---|---|---|---|
| Sign-ups | `sign_up` events | | | | |
| Activation | Signed up and passed a quiz within 7 days | | | ≥ 40% | |
| Weekly active learners | Distinct students with a study event per week (avg) | | | growing | |
| Week-1 retention | Came back 7–13 days after sign-up | | | ≥ 30% | |
| Quizzes completed | `quiz_completed` | | | | |
| Quiz pass rate | Passed / completed | | | 50–75% (too high = too easy) | |
| Biggest funnel drop | Step on Admin → Analytics with the largest loss | | | | |

## 2. Reliability and performance (Admin → Monitoring, uptime monitor)

| Indicator | Objective | Actual | Met? |
|---|---|---|---|
| Availability | 99.5% | | |
| LCP p75 | ≤ 2.5 s | | |
| INP p75 | ≤ 200 ms | | |
| CLS p75 | ≤ 0.1 | | |
| Reminders job | On time | | |
| Incidents | – | SEV1: _ SEV2: _ | |

**Error budget:** if availability or LCP missed, next release is reliability work only.

## 3. Feedback (Admin → Feedback)

| Kind | New | Done | Top themes |
|---|---|---|---|
| Bugs | | | |
| Content mistakes | | | |
| Ideas | | | |

Every content mistake fixed this month? ☐ Every bug in the backlog with an id? ☐

## 4. Maintenance

- `npm audit --omit=dev`: critical _ high _ moderate _ low _ (any production high/critical older than 7 days? why?)
- Dependabot PRs merged / open:
- Tech debt closed / added (ids):
- Major upgrade spike this month (business/12 §4):

## 5. Decisions

| Decision | Why (metric, feedback, incident) | Release |
|---|---|---|
| | | |

## 6. Next month's plan

- Release(s) and dates:
- Top 3 improvements, ranked by (students affected × impact) ÷ effort:
- Experiment or metric to watch:
