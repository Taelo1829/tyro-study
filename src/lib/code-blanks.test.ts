import { describe, expect, it } from "vitest"
import { answerMatches, countBlanks, matchingAnswer, normaliseAnswer, splitAtBlanks } from "./code-blanks"

describe("code blanks", () => {
  it("finds blanks of four or more underscores, not inside names", () => {
    expect(countBlanks("if (____) { x = ______; }")).toBe(2)
    expect(countBlanks("my____var and __init__")).toBe(0)
    expect(splitAtBlanks("a ____ b ____ c")).toEqual(["a ", " b ", " c"])
  })

  it("ignores spacing that doesn't change meaning", () => {
    expect(normaliseAnswer(" x >= 5 ;")).toBe("x>=5")
    expect(normaliseAnswer("int   x")).toBe("int x")
    expect(answerMatches("x>=5", ["x >= 5"])).toBe(true)
    expect(answerMatches("x > 5", ["x >= 5"])).toBe(false)
  })

  it("treats curly quotes as straight quotes", () => {
    expect(answerMatches("cout << “hi”", ['cout << "hi"'])).toBe(true)
  })

  it("never accepts an empty answer", () => {
    expect(answerMatches("   ", [""])).toBe(false)
    expect(matchingAnswer("", ["x"])).toBe(-1)
  })

  it("returns which accepted answer matched", () => {
    expect(matchingAnswer("i++", ["i += 1", "i++"])).toBe(1)
  })
})
