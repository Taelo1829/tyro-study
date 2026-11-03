import { describe, expect, it, vi } from "vitest"
import { log, redact, requestIdFrom, timed } from "./log"
import { fingerprint, isStale, normaliseMessage } from "./monitoring"
import { routeTemplate } from "./route-template"

describe("redact", () => {
  it("removes emails, bearer tokens, secrets in URLs and credentials", () => {
    const s = redact("user thabo@example.com failed; Authorization: Bearer abc.def-123; /api/cron?key=s3cret&x=1; postgresql://u:pw@host/db; tok_" + "a".repeat(40))
    expect(s).not.toMatch(/thabo@example\.com|abc\.def-123|s3cret|:pw@|a{40}/)
    expect(s).toContain("[email]")
    expect(s).toContain("key=[redacted]")
    expect(s).toContain("***:***@")
  })
})

describe("log", () => {
  it("writes one JSON line with the error redacted", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    log.error("test.failed", { requestId: "r1", err: new Error("no user lerato@test.co.za") })
    const line = JSON.parse(spy.mock.calls[0][0] as string)
    expect(line).toMatchObject({ level: "error", event: "test.failed", requestId: "r1", errorName: "Error" })
    expect(line.error).toBe("no user [email]")
    spy.mockRestore()
  })

  it("timed() logs duration and rethrows", async () => {
    const info = vi.spyOn(console, "log").mockImplementation(() => {})
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(await timed("t.ok", async () => 42)).toBe(42)
    expect(JSON.parse(info.mock.calls[0][0] as string)).toMatchObject({ event: "t.ok" })
    await expect(timed("t.bad", async () => { throw new Error("boom") })).rejects.toThrow("boom")
    expect(JSON.parse(err.mock.calls[0][0] as string)).toMatchObject({ event: "t.bad.failed", error: "boom" })
    info.mockRestore(); err.mockRestore()
  })

  it("reads Vercel's request id", () => {
    expect(requestIdFrom(new Headers({ "x-vercel-id": "cpt1::abc" }))).toBe("cpt1::abc")
    expect(requestIdFrom({ "x-vercel-id": ["a", "b"] })).toBe("a")
    expect(requestIdFrom(null)).toBeNull()
  })
})

describe("error grouping", () => {
  it("normalises ids, numbers and quoted values so repeats share a fingerprint", () => {
    const a = 'Topic "cm1abcdefghijklmnopqrstu" not found after 3 tries (id 550e8400-e29b-41d4-a716-446655440000)'
    const b = 'Topic "cm9zyxwvutsrqponmlkjihgf" not found after 7 tries (id 123e4567-e89b-12d3-a456-426614174000)'
    expect(normaliseMessage(a)).toBe(normaliseMessage(b))
    expect(fingerprint("server", "Error", a, "/api/x")).toBe(fingerprint("server", "Error", b, "/api/x"))
    expect(fingerprint("server", "Error", a, "/api/x")).not.toBe(fingerprint("server", "Error", a, "/api/y"))
    expect(fingerprint("server", "TypeError", a, "/api/x")).not.toBe(fingerprint("server", "Error", a, "/api/x"))
  })

  it("turns page paths into route templates", () => {
    expect(routeTemplate("/modules/cm1abcdefghijklmnopqrstu/topics/cm9zyxwvutsrqponmlkjihgf?tab=quiz")).toBe("/modules/[id]/topics/[id]")
    expect(routeTemplate("/notes/how-to-study")).toBe("/notes/how-to-study")
    expect(routeTemplate(null)).toBeNull()
  })
})

describe("isStale", () => {
  it("required jobs alert when they never ran; optional ones wait for a first run", () => {
    expect(isStale("cron:reminders", null)).toBe(true)
    expect(isStale("cron:reminders", 10)).toBe(false)
    expect(isStale("cron:reminders", 45)).toBe(true)
    expect(isStale("cron:daily-digest", null)).toBe(false)
    expect(isStale("cron:daily-digest", 27 * 60)).toBe(true)
    expect(isStale("unknown", null)).toBe(false)
  })
})
