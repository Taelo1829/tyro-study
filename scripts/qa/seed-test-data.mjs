#!/usr/bin/env node
/**
 * Test fixtures for scripts/qa/security-tests.mjs and a11y-scan.mjs:
 * five accounts (two students, a high school learner, an admin, a superuser),
 * a module with an unlocked/published topic (with an XSS payload in its lesson),
 * a locked topic, a high school subject, and private data belonging to student B.
 *
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tyro_qa TEST_PASSWORD='...' node scripts/qa/seed-test-data.mjs
 *
 * Only touches its own fixture rows (ids/emails below). Refuses any database
 * that isn't on this machine unless QA_ALLOW_REMOTE=1 (e.g. a Neon *branch*
 * for a preview). Never run it against production.
 */
import { config } from "dotenv"
import pg from "pg"
import bcrypt from "bcryptjs"

config({ path: [".env.qa", ".env.local", ".env"], quiet: true })
const url = process.env.QA_DATABASE_URL || process.env.DATABASE_URL
if (!url) throw new Error("Set QA_DATABASE_URL (or DATABASE_URL)")
const host = new URL(url).hostname
if (!["localhost", "127.0.0.1", "::1"].includes(host) && process.env.QA_ALLOW_REMOTE !== "1") {
  throw new Error(`Refusing to seed ${host}. Use a local database, or a Neon branch with QA_ALLOW_REMOTE=1. Never production.`)
}
const c = new pg.Client({ connectionString: url })
await c.connect()
const pw = await bcrypt.hash(process.env.TEST_PASSWORD || "Test-Password-123", 10)
const q = (s, v = []) => c.query(s, v)
// Remove previous fixtures only (cascades to their attempts, events, messages...)
await q(`DELETE FROM users WHERE email IN ('a@test.local','b@test.local','h@test.local','admin@test.local','super@test.local') OR id IN ('u_a','u_b','u_h','u_adm','u_su')`)
await q(`DELETE FROM modules WHERE id IN ('m1','m_hs')`)
// Test databases only: clear sign-in lockouts left by earlier runs of security-tests.mjs
await q(`DELETE FROM rate_limits`).catch(() => {})
const users = [
  ["u_a", "Student A", "a@test.local", "STUDENT", false, "tertiary"],
  ["u_b", "Student B", "b@test.local", "STUDENT", false, "tertiary"],
  ["u_h", "Learner H", "h@test.local", "STUDENT", false, "highschool"],
  ["u_adm", "Admin", "admin@test.local", "ADMIN", false, "tertiary"],
  ["u_su", "Super", "super@test.local", "ADMIN", true, "tertiary"],
]
for (const [id, name, email, role, su, level] of users)
  await q(`INSERT INTO users (id,name,email,password,role,"isSuperuser",level,"emailVerified","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now(),now())`, [id, name, email, pw, role, su, level])
await q(`INSERT INTO modules (id,title,description,level,"createdAt") VALUES ('m1','MAT1503 Linear Algebra I','Matrices','tertiary',now()),('m_hs','Mathematics - Grade 12','CAPS','highschool',now())`)
await q(`INSERT INTO chapters (id,"moduleId",title,"order","createdAt") VALUES ('c1','m1','Systems and matrices',0,now()),('c_hs','m_hs','Functions',0,now())`)
await q(`INSERT INTO topics (id,"chapterId",title,content,"order",locked,published,"createdAt") VALUES
 ('t1','c1','Inverses','<h2>Inverses</h2><p>A matrix is invertible if det(A) ≠ 0.</p><img src=x onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">x</a>',0,false,true,now()),
 ('t2','c1','Elementary matrices','<p>Locked topic content</p>',1,true,false,now()),
 ('t_hs','c_hs','Parabolas','<p>y = ax^2</p>',0,false,false,now())`)
for (const t of ["t1", "t2"]) for (let i = 1; i <= 3; i++) {
  await q(`INSERT INTO questions (id,"topicId",question,difficulty,"createdAt") VALUES ($1,$2,$3,'medium',now())`, [`q_${t}_${i}`, t, `Question ${i} on ${t}?`])
  for (const [k, ok] of [["a", true], ["b", false], ["c", false]])
    await q(`INSERT INTO answers (id,"questionId",answer,"isCorrect") VALUES ($1,$2,$3,$4)`, [`a_${t}_${i}_${k}`, `q_${t}_${i}`, `Option ${k}`, ok])
}
await q(`INSERT INTO module_enrollments (id,"userId","moduleId","enrolledAt") VALUES ('e_a','u_a','m1',now()),('e_b','u_b','m1',now())`)
await q(`INSERT INTO calendar_events (id,"userId",type,title,"startAt","createdAt","updatedAt") VALUES ('ev_b','u_b','EXAM','B private exam',now()+interval '3 days',now(),now())`)
await q(`INSERT INTO quiz_attempts (id,"userId","topicId","totalQuestions","questionsData",settings,status,"startedAt","createdAt","updatedAt") VALUES ('qa_b','u_b','t1',3,'[]','{"passingScore":70,"source":"topic:t1"}','IN_PROGRESS',now(),now(),now())`)
await q(`INSERT INTO question_attempts (id,"quizAttemptId","questionId","order",status,"createdAt","updatedAt") VALUES ('qq_b1','qa_b','q_t1_1',0,'PENDING',now(),now())`)
await q(`INSERT INTO "Conversation" (id,"user1Id","user2Id","createdAt","updatedAt") VALUES ('conv_bh','u_b','u_h',now(),now())`)
await q(`INSERT INTO "Message" (id,"conversationId","senderId",type,content,"createdAt") VALUES ('msg1','conv_bh','u_b','TEXT','private message between B and H',now())`)
await q(`INSERT INTO "Friendship" (id,"senderId","receiverId",status,"createdAt","updatedAt") VALUES ('fr_bh','u_b','u_h','ACCEPTED',now(),now())`)
// Load-test fixtures: an unlocked practice topic with 80 questions, and 40 students
await q(`INSERT INTO topics (id,"chapterId",title,content,"order",locked,published,"createdAt") VALUES ('t3','c1','Practice set','<p>Practice</p>',2,false,false,now())`)
for (let i = 1; i <= 80; i++) {
  await q(`INSERT INTO questions (id,"topicId",question,difficulty,"createdAt") VALUES ($1,'t3',$2,'medium',now())`, [`q3_${i}`, `Practice question ${i}?`])
  await q(`INSERT INTO answers (id,"questionId",answer,"isCorrect") VALUES ($1,$2,'right',true),($3,$2,'wrong',false)`, [`a3_${i}_a`, `q3_${i}`, `a3_${i}_b`])
}
await q(`DELETE FROM users WHERE email LIKE 'load%@test.local'`)
for (let i = 1; i <= 40; i++)
  await q(`INSERT INTO users (id,name,email,password,role,level,"emailVerified","createdAt","updatedAt") VALUES ($1,$2,$3,$4,'STUDENT','tertiary',now(),now(),now())`, [`lu${i}`, `Load ${i}`, `load${i}@test.local`, pw])
console.log("Seeded QA fixtures")
await c.end()
