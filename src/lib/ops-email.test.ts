import { expect, it, vi } from "vitest"
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
import { digestHtml } from "./ops-email"
import { digestText, type OpsReport } from "./ops-report"
const report: OpsReport = {
  generatedAt: new Date("2026-11-16T12:00:00Z"), errors: { newLastHour: 0, activeLastHour: 0, activeLastDay: 0, openGroups: 0 },
  errorGroups: [], heartbeats: [], feedback24h: [], vitals: { overall: [], slowestPages: [] },
  activity24h: { activeStudents: 12, signUps: 3, quizzesCompleted: 8, answers: 160 },
}
it("renders a branded HTML digest and keeps the plain-text version", () => {
  const digest = digestText(report, "https://example.com")
  const html = digestHtml(report, "https://example.com", digest.needsAttention)
  expect(html).toContain("Your daily overview")
  expect(html).toContain("Quizzes finished")
  expect(html).toContain("View analytics")
  expect(html).not.toContain("Flagged questions ·")
  expect(digest.text).toContain("12 active")
})
it("highlights open reports and escapes question and report text", () => {
  const flagged = { ...report, questionFlags: { total: 1, items: [{ id: "f", questionId: "q", message: '<script>alert("bad")</script> A < B', page: "/admin/topics/t", createdAt: new Date(), total: 1 }] } }
  const digest = digestText(flagged, "https://example.com")
  expect(digest.needsAttention).toBe(true)
  expect(digest.text).toContain("FLAGGED QUESTIONS: 1")
  const html = digestHtml(flagged, "https://example.com", true)
  expect(html).toContain("Flagged questions · 1")
  expect(html).toContain("&lt;script&gt;")
  expect(html).not.toContain("<script>")
  expect(html).toContain("https://example.com/admin/topics/t")
})
