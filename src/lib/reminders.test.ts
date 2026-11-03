import { describe, expect, it } from "vitest"
import { timeUntil } from "./reminders"

describe("reminder wording", () => {
  it.each([
    [0, "now"],
    [1, "now"],
    [15, "in 15 minutes"],
    [60, "in 1 hour"],
    [180, "in 3 hours"],
    [24 * 60, "tomorrow"],
    [3 * 24 * 60, "in 3 days"],
  ])("%i minutes ahead → %s", (minutes, text) => {
    expect(timeUntil(minutes)).toBe(text)
  })
})
