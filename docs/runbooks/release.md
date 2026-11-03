# Runbook: releasing to production

**Who:** the product owner (Taelo). **How long:** about 15 minutes, mostly waiting.
**When:** not during an exam week evening peak (18:00–23:00 SAST) unless it's a fix for that exam.

## Before

- [ ] The changes are merged to `main`, CI is green, and staging (`staging.tyrostudy.co.za`) shows the new version: open `/api/health` there and check `commit`.
- [ ] Quick check on staging on a phone: sign in, open a lesson, answer a quiz question, open the timetable. For milestone releases, UAT is signed off (business/08 §9).
- [ ] Every new migration is additive (expand). Anything that removes or renames is in a **later** release than the code that stopped using it (docs/runbooks/migrations.md).
- [ ] `CHANGELOG.md`: rename **Unreleased** to `## [x.y.z] - YYYY-MM-DD`, add a new empty **Unreleased** above it, merge that to `main` and wait for CI.

## Release

0. `node scripts/release/preflight.mjs X.Y.Z` on your PC → must say **GO**. Note the production commit it prints (your rollback target). Check the flag values in Vercel (business/10 §4.2).
1. GitHub → **Actions → Release to production → Run workflow**. Enter the version (e.g. `1.0.0`), leave ref as `main`.
2. The **checks** job confirms CI passed for that commit, the tag is new, production can fast-forward and the notes exist. Its summary lists the new migrations.
3. **Approve** the `production` environment when GitHub asks (the migrate job waits for you). Look at the migration list once more.
4. The workflow then:
   - creates the Neon backup branch `pre-vX.Y.Z` (only when there are migrations; it keeps the 3 newest),
   - runs `prisma migrate deploy` against production,
   - fast-forwards the `production` branch, which Vercel builds and deploys (2–4 minutes),
   - waits until `https://www.tyrostudy.co.za/api/health` reports the new commit and runs the smoke test,
   - tags `vX.Y.Z` and creates the GitHub release from the changelog.

## After

- [ ] Open the site on your phone, sign in, finish one quiz.
- [ ] Vercel → Logs: no new errors in the first 30 minutes. `/admin/analytics`: events still arriving.
- [ ] If something is wrong: **docs/runbooks/rollback.md**. Don't try to fix forward under pressure if students are blocked; roll back first.

## Hotfix (urgent fix while `main` has unreleased work)

1. `git switch -c hotfix/short-name origin/production`, fix, open a PR **into `main`** as normal *and* push the branch so CI runs on it.
2. When CI is green on the hotfix branch, run the release workflow with `ref` = `hotfix/short-name` and a patch version.
3. Merge the PR into `main` so the fix isn't lost; the next normal release then fast-forwards as usual.

## If the workflow fails

| Failed step | Meaning | Do |
|---|---|---|
| CI passed for this commit | CI hasn't finished or failed | Wait for green or fix on `main` |
| Production can fast-forward | `production` has a commit `main` doesn't (an old hotfix) | Merge `origin/production` into `main` |
| Release notes exist | No `## [x.y.z]` in CHANGELOG | Add it on `main` |
| Apply migrations | Migration failed on production | Nothing was deployed. Read the error; `npx prisma migrate status`; see migrations runbook "failed migration" |
| Fast-forward production | Branch protection or permissions | Allow GitHub Actions to push `production` (business/09 §8) |
| Smoke test | New version not live within 15 minutes, or a check failed | Vercel dashboard: did the build fail? If live but broken → rollback runbook |
