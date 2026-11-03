import { describe, expect, it } from "vitest"
import ExcelJS from "exceljs"
import { buildFlashcardsTemplate, parseFlashcardsExcel } from "./flashcards"
import { buildQuestionsTemplate, parseQuestionsExcel } from "./questions"

async function sheet(rows: (string | number)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("S")
  rows.forEach(r => ws.addRow(r))
  return Buffer.from(await wb.xlsx.writeBuffer())
}

describe("Excel templates round-trip", () => {
  it("flashcards template parses back to its sample rows", async () => {
    const { flashcards, errors } = await parseFlashcardsExcel(await buildFlashcardsTemplate())
    expect(errors).toEqual([])
    expect(flashcards).toHaveLength(2)
    expect(flashcards[0].front).toBe("What is photosynthesis?")
  })

  it("questions template parses back to valid questions", async () => {
    const { questions, errors } = await parseQuestionsExcel(await buildQuestionsTemplate())
    expect(errors).toEqual([])
    expect(questions[1]).toMatchObject({ correctOption: "Mercury", difficulty: "medium", options: ["Venus", "Mercury", "Earth", "Mars"] })
  })
})

describe("parsing", () => {
  it("reports real Excel row numbers, skips blank rows and accepts header spacing/case", async () => {
    const buf = await sheet([["Front", " Back "], ["a", "b"], [], ["only front", ""], [12, 34]])
    const { flashcards, errors } = await parseFlashcardsExcel(buf)
    expect(flashcards).toEqual([{ front: "a", back: "b" }, { front: "12", back: "34" }])
    expect(errors).toEqual(["Row 4: both front and back are required"])
  })

  it("checks the correct option matches an option", async () => {
    const buf = await sheet([["question", "option_a", "option_b", "correct_option"], ["Q?", "x", "y", "z"]])
    const { questions, errors } = await parseQuestionsExcel(buf)
    expect(questions).toEqual([])
    expect(errors[0]).toMatch(/Row 2: correct_option must match/)
  })

  it("rejects files that aren't .xlsx", async () => {
    await expect(parseFlashcardsExcel(Buffer.from("not a spreadsheet"))).rejects.toThrow()
  })
})
