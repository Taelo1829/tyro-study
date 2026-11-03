import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { expect, it } from "vitest"

it("preserves existing accounts and starts new accounts at the first step", async () => {
  const db = new PGlite()
  try {
    await db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY); INSERT INTO users (id) VALUES ('existing');`)
    await db.exec(readFileSync(new URL("../../prisma/migrations/20261103120000_onboarding/migration.sql", import.meta.url), "utf8"))
    await db.exec(`INSERT INTO users (id) VALUES ('new');`)
    const { rows } = await db.query(`SELECT id, "onboardingStep", "dailyGoal" FROM users ORDER BY id`)
    expect(rows).toEqual([
      { id: "existing", onboardingStep: 3, dailyGoal: null },
      { id: "new", onboardingStep: 0, dailyGoal: null },
    ])
    await db.exec(`UPDATE users SET "onboardingStep" = 3, "dailyGoal" = 10 WHERE id = 'new'`)
    await expect(db.exec(`UPDATE users SET "dailyGoal" = -1 WHERE id = 'new'`)).rejects.toThrow()
    await expect(db.exec(`UPDATE users SET "onboardingStep" = 4 WHERE id = 'new'`)).rejects.toThrow()
  } finally {
    await db.close()
  }
})
