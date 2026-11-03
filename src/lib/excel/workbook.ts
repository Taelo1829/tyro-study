import ExcelJS from "exceljs"

/**
 * Small wrapper around exceljs for the admin Excel templates and imports.
 * Replaces SheetJS "xlsx" 0.18.5 (unmaintained on npm; prototype pollution and
 * ReDoS advisories with no npm fix). Supports .xlsx only: legacy .xls files
 * must be saved as .xlsx first.
 */

export async function buildSheet(name: string, headers: readonly string[], rows: string[][], widths: number[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(name)
  ws.addRow([...headers])
  ws.getRow(1).font = { bold: true }
  for (const r of rows) ws.addRow(r)
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })
  return Buffer.from(await wb.xlsx.writeBuffer())
}

export interface SheetRow {
  /** Row number as Excel shows it (header is row 1) */
  row: number
  /** Cell text by header name, as written in the header row */
  values: Record<string, string>
}

/** Reads the first worksheet: the first row is the header; empty rows are skipped. Throws on files that aren't .xlsx. */
export async function readFirstSheet(buffer: Buffer): Promise<{ sheetFound: boolean; rows: SheetRow[] }> {
  const wb = new ExcelJS.Workbook()
  // exceljs's typings expect its own Buffer type; a Node Buffer works at runtime
  await wb.xlsx.load(buffer as unknown as ArrayBuffer)
  const ws = wb.worksheets[0]
  if (!ws) return { sheetFound: false, rows: [] }

  const headers: string[] = []
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = cell.text.trim()
  })

  const rows: SheetRow[] = []
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return
    const values: Record<string, string> = {}
    headers.forEach((h, col) => {
      if (h) values[h] = row.getCell(col).text ?? ""
    })
    if (Object.values(values).some(v => v.trim() !== "")) rows.push({ row: rowNumber, values })
  })
  return { sheetFound: true, rows }
}

export const XLSX_ONLY = "Upload an Excel file saved as .xlsx (in Excel: File → Save As → Excel Workbook)."
