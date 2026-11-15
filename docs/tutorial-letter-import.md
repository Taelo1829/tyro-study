# Tutorial-letter import

Admins open a module and choose **Upload tutorial letter**. Upload the letter PDF and, for books without verified contents, the prescribed edition's contents pages. The import previews the syllabus, study plan and checkpoint locations before generating anything. **Generate lessons and assessments** writes resumable drafts; **Replace module content** applies the reviewed result in one transaction.

The new `20261114190000_tutorial_letter_imports` migration must be deployed before using the importer (`npm run db:deploy`, through the normal release process). It adds one table for server-owned drafts and the applied study guide. Existing module lists do not depend on this table.

## Behaviour

- Book chapter and section headings come from verified contents, in book order. Only prescribed chapters are selected. Other books require a supplied contents PDF; a citation alone is insufficient.
- The included Stallings 10th Global Edition contents were verified against Pearson's published preview: https://api.pageplace.de/preview/DT0400.9781292096865_A26551006/preview-9781292096865_A26551006.pdf. Review/exercise sections are excluded from lesson topics. A missing referenced chapter (such as Chapter 0 in the supplied letter) is identified in the study guidance rather than invented.
- Lessons are original explanations targeting approximately 2,500 readable characters, with quizzes in the related assessment's format. They are not copies of unprovided textbook pages.
- Letter assessments generate **practice** quizzes, including written tasks supported by the existing PDF/photo marking flow. Self-tests remain labelled “do not submit”. They are not represented as official submissions or verbatim question-paper imports.
- If any uploaded assignment exists, it is retained and moved after its new prerequisites; no letter assessments are generated. Existing answers and attempts on those assignments remain attached. Its questions inform the rewritten lessons.
- Each checkpoint follows the last prerequisite in the new chapter order. The letter's possibly different week-by-week study order is preserved in the student study guide.
- Replacement removes the old active chapters, topics, attachments and exercises. Old question records are detached rather than deleted, preserving quiz answer history. Old topic progress no longer applies. Existing mock-exam configuration is cleared because it belongs to the previous syllabus.
- Replacement rejects stale or incomplete drafts and is idempotent. Generation failures keep completed drafts. The student guide endpoint returns only public guidance, never source text, model answers or private rubrics.
- Historical letter years remain visible. No missing deadlines or exam formats are invented. The supplied COS2621 letter is from 2022, refers to companion Guide 102, and directs students to myUnisa for due dates.

## Student weekly planner

After a reviewed tutorial letter is applied, enrolled students can create a weekly plan from the module page. The planner uses the letter's numbered week ranges and the student's chosen start date. Overlapping ranges share one weekly goal; multi-week reading blocks are presented as staged reading/practice goals, not invented textbook section allocations.

Goals are stored as private study sessions in the existing timetable. Students can mark them complete, view all weeks, and reschedule unfinished goals at one per week while preserving completed work and unrelated calendar events. Catch-up flags appear after the study week ends. Optional reminders use the existing notification service at 09:00 South Africa time; past reminders are not scheduled. These dates are personal targets, never official assignment deadlines. The planner reuses the existing calendar tables. Its per-module admin switch defaults to off and requires migration `20261115090000_weekly_planner_setting`. In Admin → Module, turn on Study guide & weekly planner to make it available. Turning it off hides the student study guide and planner goals from the module and timetable and pauses reminders, while retaining saved progress.

Planner checks: `npm test -- src/lib/weekly-study-plan.test.ts src/app/api/modules/[id]/weekly-plan/route.test.ts`.

## Import validation

`npm test -- src/lib/tutorial-letter.test.ts` covers source validation, checkpoint placement, preservation, stale/incomplete imports, idempotency, format enforcement, resumability and private-answer separation. `npm run typecheck` and focused ESLint checks also apply.
