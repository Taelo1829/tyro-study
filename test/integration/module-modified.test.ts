import { PGlite } from "@electric-sql/pglite"
import { readFile } from "node:fs/promises"
import { expect, it } from "vitest"

it("tracks module and content edits, moves and deletions without counting cached quiz explanations", async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      CREATE TABLE modules (id text PRIMARY KEY, title text, "createdAt" timestamp DEFAULT '2020-01-01');
      CREATE TABLE chapters (id text PRIMARY KEY, "moduleId" text, title text);
      CREATE TABLE topics (id text PRIMARY KEY, "chapterId" text, content text);
      CREATE TABLE questions (id text PRIMARY KEY, "topicId" text, "chapterId" text, question text, "studyNote" text, "studyNoteClaimedAt" timestamp);
      CREATE TABLE answers (id text PRIMARY KEY, "questionId" text, answer text);
      CREATE TABLE course_modules ("moduleId" text);
      INSERT INTO modules(id) VALUES ('a'), ('b');
      INSERT INTO chapters VALUES ('ca','a','A'), ('cb','b','B');
      INSERT INTO topics VALUES ('t','ca','Lesson');
      INSERT INTO questions(id,"topicId",question) VALUES ('q','t','Question');
      INSERT INTO answers VALUES ('answer','q','Answer');
    `)
    await db.exec(await readFile("prisma/migrations/20261116160000_module_modified/migration.sql", "utf8"))
    const dates = async () => (await db.query<{ id: string; date: string }>('SELECT id, "updatedAt"::text AS date FROM modules ORDER BY id')).rows.map(row => row.date)
    const initial = await dates()
    await db.exec(`UPDATE modules SET title='Changed' WHERE id='a'`)
    expect((await dates())[0]).not.toBe(initial[0])
    for (const sql of [
      `UPDATE topics SET content='New lesson' WHERE id='t'`,
      `UPDATE questions SET question='New question' WHERE id='q'`,
      `UPDATE answers SET answer='New answer' WHERE id='answer'`,
      `INSERT INTO course_modules VALUES ('a')`,
      `DELETE FROM answers WHERE id='answer'`,
    ]) {
      const before = await dates()
      await new Promise(resolve => setTimeout(resolve, 3))
      await db.exec(sql)
      expect((await dates())[0]).not.toBe(before[0])
    }
    const beforeExplanation = await dates()
    await db.exec(`UPDATE questions SET "studyNote"='Explanation' WHERE id='q'`)
    expect(await dates()).toEqual(beforeExplanation)
    await new Promise(resolve => setTimeout(resolve, 3))
    await db.exec(`UPDATE topics SET "chapterId"='cb' WHERE id='t'`)
    const moved = await dates()
    expect(moved[0]).not.toBe(beforeExplanation[0])
    expect(moved[1]).not.toBe(beforeExplanation[1])
  } finally { await db.close() }
})
