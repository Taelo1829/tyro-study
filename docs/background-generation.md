# Background generation

Generation jobs, their input documents, task list, progress, errors and results are stored in PostgreSQL. The initiating admin owns the job and is re-authorized on every step. Cookies and session tokens are never stored. The worker uses an in-process principal only while executing allow-listed generation handlers. Review/apply/publish/delete APIs cannot be queued.

Deploy the migration with `npm run db:deploy` before deploying this code. Set `NEXTAUTH_SECRET` (already required by authentication) or `CRON_SECRET`. The app wakes a new worker invocation after each durable step, independent of the browser. `GENERATION_WORKER_URL` can override the server's own origin; otherwise Vercel's deployment URL, `NEXTAUTH_URL`, or local port 4000 is used. Protected Vercel deployments also need `VERCEL_AUTOMATION_BYPASS_SECRET` for internal wake requests.

For recovery after a process/deployment interruption, call `GET /api/generation/run` every five minutes with `Authorization: Bearer <CRON_SECRET>` from the existing external scheduler. The existing reminders cron also wakes this worker. Do not rely on a browser being open. The daily-only Vercel Hobby cron is not a timely recovery scheduler. No new paid service is required.

Each invocation processes one step (up to 300 seconds), checkpoints it, then requests the next invocation. Database row leases and `SKIP LOCKED` prevent concurrent execution of a job. A seven-minute expired lease is reported as an interrupted job, because blindly rerunning a partially committed write could duplicate content. The activity page preserves completed outputs and offers explicit retry of unfinished steps. Active identical submissions by the same user are deduplicated.

The Generation activity page shows saved progress, failures and results, including drafts that still require review before replacement. Push uses the existing VAPID subscriptions and opens the activity page. Users must enable device notifications to receive alerts while the app is closed; saved in-app activity remains available without push permission. Initial file uploads must finish before work is submitted.

Deployment validation: queue a tutorial-letter draft-all job, leave the page after the queued notice, close the browser, and confirm task progress advances in the database. Reopen Generation activity and review the persisted results. Test with push enabled on a subscribed device. Test the recovery scheduler separately by leaving a job queued and invoking the protected worker endpoint.
