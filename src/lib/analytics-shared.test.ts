import { describe, expect, it } from "vitest"
import { cleanPath, cleanProps, isClientEvent } from "./analytics-shared"

describe("analytics input cleaning", () => {
  it("only accepts client event names on the allowlist", () => {
    expect(isClientEvent("page_view")).toBe(true)
    expect(isClientEvent("quiz_completed")).toBe(false) // server-only
    expect(isClientEvent("anything")).toBe(false)
    expect(isClientEvent(42)).toBe(false)
  })

  it("strips query strings and fragments from paths (they can hold tokens)", () => {
    expect(cleanPath("/reset-password?token=secret#x")).toBe("/reset-password")
    expect(cleanPath("https://evil.example/x")).toBeNull()
    expect(cleanPath(undefined)).toBeNull()
    expect(cleanPath("/" + "a".repeat(500))!.length).toBe(300)
  })

  it("keeps props small, flat and primitive", () => {
    const big = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, i]))
    expect(Object.keys(cleanProps(big)!)).toHaveLength(12)
    expect(cleanProps({ nested: { a: 1 }, list: [1], ok: true, n: 2, s: "x".repeat(300), nan: Number.NaN })).toEqual({
      ok: true,
      n: 2,
      s: "x".repeat(200),
    })
    expect(cleanProps(null)).toBeNull()
    expect(cleanProps(["a"])).toBeNull()
    expect(cleanProps({ nested: {} })).toBeNull()
  })
})
