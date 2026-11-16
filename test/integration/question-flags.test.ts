import { PGlite } from "@electric-sql/pglite"
import { readFile } from "node:fs/promises"
import { expect, it } from "vitest"

it("deduplicates open reports, allows reports after resolution, and excludes resolved reports from the digest", async () => {
  const db = new PGlite()
  try {
    await db.exec('CREATE TABLE users (id text PRIMARY KEY); INSERT INTO users VALUES (\'student\');')
    await db.exec(await readFile("prisma/migrations/20261030130000_feedback/migration.sql", "utf8"))
    await db.exec(await readFile("prisma/migrations/20261116170000_question_flags/migration.sql", "utf8"))
    const insert = (id: string) => db.query(`INSERT INTO feedback (id,"userId",kind,message,"questionId") VALUES ($1,'student','content','Snapshot','q') ON CONFLICT ("userId", "questionId") WHERE "questionId" IS NOT NULL AND status IN ('new','planned') DO NOTHING`, [id])
    await insert("first")
    await insert("duplicate")
    expect((await db.query("SELECT * FROM feedback")).rows).toHaveLength(1)
    await db.exec("UPDATE feedback SET status='done'")
    await insert("new-report")
    const open = await db.query(`SELECT id, COUNT(*) OVER()::int AS total FROM feedback WHERE "questionId" IS NOT NULL AND status IN ('new','planned')`)
    expect(open.rows).toEqual([{ id: "new-report", total: 1 }])
  } finally { await db.close() }
})
