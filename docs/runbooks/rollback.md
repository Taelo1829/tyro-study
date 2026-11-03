# Runbook: rolling back

**Rule:** roll back the **code** first; touch the **database** only if data was damaged. Because migrations are additive, the previous code runs fine on the new schema.

## 1. Decide (2 minutes)

| Symptom after a release | Action |
|---|---|
| Site down, sign-in broken, quizzes can't be answered or saved | **Roll back code now** (step 2) |
| One feature broken, a workaround exists | Fix forward with a hotfix release (release runbook) |
| Wrong or lost data (scores, progress, accounts) | Roll back code (step 2), **then** step 4 |
| Visual glitch | Fix forward |

## 2. Roll back the code (1 minute)

Vercel → Tyro project → **Production Deployment → Instant Rollback** → choose the previous deployment → Confirm.
(Or `vercel rollback` with the CLI.)

- **Hobby plan:** only the deployment immediately before the current one can be restored. If you need to go back further, use step 3.
- **Pro plan:** any previous production deployment.
- Instant Rollback serves the old build with the environment variables it was built with. If you changed a variable since, it isn't applied.
- **After a rollback, Vercel stops auto-assigning new production deployments.** New pushes to `production` won't go live until you **Undo Rollback** (dashboard) or `vercel promote <deployment>` the fixed release.

Check: `https://www.tyrostudy.co.za/api/health` shows the previous commit; sign in and answer a question.

## 3. Older version, or a clean redeploy

The release workflow only moves `production` forward, so you can't release an old tag again. Instead:
1. On `main`, `git revert` the bad commits, merge, wait for CI.
2. Release a new patch version. The migration step is a no-op; the reverted code goes live.

## 4. Data (only if data was damaged)

The workflow created the Neon branch **`pre-vX.Y.Z`** just before migrating (a full copy at that moment). Neon can also restore any point inside the history window (Free plan: 6 hours; Launch: up to 7 days; Scale: up to 30 days).

1. **Don't overwrite production blindly**: writes made since the release (sign-ups, quiz attempts) would be lost.
2. Find the damage: compare tables between production and `pre-vX.Y.Z` (Neon SQL editor on the backup branch, or connect with psql).
3. Small damage: copy the affected rows back from the backup branch.
4. Large damage, and losing writes since the release is acceptable: Neon console → production branch → **Restore** to the timestamp just before the release (Neon keeps a backup of the pre-restore state). Then check `npx prisma migrate status` matches the code you're running.
5. POPIA: if personal information was exposed or lost, follow the breach steps in business/08 §6.1 (notify the Information Regulator and affected students as soon as reasonably possible).

## 5. Afterwards

- Write 5 lines in the GitHub release: what broke, when, how it was found, what fixed it, what prevents it next time (a test, a checklist line).
- Add a regression test and a line to docs/qa/regression-checklist.md.
