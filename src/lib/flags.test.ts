import { afterEach, describe, expect, it } from "vitest"
import { bucket, flagSettings, flagValue, isEnabled, parseFlag } from "./flags"

const ENV = "FLAG_HIGHSCHOOL_SIGNUP"

afterEach(() => {
  delete process.env[ENV]
})

describe("parseFlag", () => {
  it("accepts on/off, admins and percentages", () => {
    expect(parseFlag("on")).toBe("on")
    expect(parseFlag(" OFF ")).toBe("off")
    expect(parseFlag("true")).toBe("on")
    expect(parseFlag("0")).toBe("off")
    expect(parseFlag("admins")).toBe("admins")
    expect(parseFlag("25%")).toBe("25%")
    expect(parseFlag("007%")).toBe("7%")
  })
  it("rejects anything else", () => {
    for (const v of ["", undefined, null, "maybe", "150%", "25", "-5%"]) expect(parseFlag(v)).toBeNull()
  })
})

describe("isEnabled", () => {
  it("uses the default when unset or invalid", () => {
    expect(flagValue("highschool_signup")).toBe("on")
    process.env[ENV] = "sometimes"
    expect(isEnabled("highschool_signup")).toBe(true)
    expect(flagSettings().find(f => f.flag === "highschool_signup")?.source).toBe("invalid env (default used)")
  })

  it("off and on apply to everyone", () => {
    process.env[ENV] = "off"
    expect(isEnabled("highschool_signup", { userId: "u1", role: "ADMIN" })).toBe(false)
    process.env[ENV] = "on"
    expect(isEnabled("highschool_signup")).toBe(true)
  })

  it("admins: only admins and superusers", () => {
    process.env[ENV] = "admins"
    expect(isEnabled("highschool_signup", { userId: "u1", role: "STUDENT" })).toBe(false)
    expect(isEnabled("highschool_signup", { userId: "u1" })).toBe(false)
    // roles as stored in the database (Role enum) and as sessions carry them
    expect(isEnabled("highschool_signup", { userId: "u1", role: "ADMIN" })).toBe(true)
    expect(isEnabled("highschool_signup", { userId: "u1", role: "admin" })).toBe(true)
  })

  it("percentages are stable per user, roughly the right share, and include admins", () => {
    process.env[ENV] = "25%"
    const ids = Array.from({ length: 4000 }, (_, i) => `user-${i}`)
    const on = ids.filter(id => isEnabled("highschool_signup", { userId: id }))
    expect(on.length / ids.length).toBeGreaterThan(0.21)
    expect(on.length / ids.length).toBeLessThan(0.29)
    // same answer every time
    expect(ids.filter(id => isEnabled("highschool_signup", { userId: id }))).toEqual(on)
    // raising the percentage only adds users
    process.env[ENV] = "50%"
    const on50 = new Set(ids.filter(id => isEnabled("highschool_signup", { userId: id })))
    expect(on.every(id => on50.has(id))).toBe(true)
    // signed out: off; admin: on
    expect(isEnabled("highschool_signup", {})).toBe(false)
    process.env[ENV] = "0%"
    expect(isEnabled("highschool_signup", { userId: "x", role: "ADMIN" })).toBe(true)
  })

  it("buckets differ between flags", () => {
    const same = Array.from({ length: 200 }, (_, i) => `u${i}`).filter(id => bucket("a", id) === bucket("b", id)).length
    expect(same).toBeLessThan(20)
  })
})
