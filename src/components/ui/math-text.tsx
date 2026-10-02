import { Fragment } from "react"
import { cn } from "@/lib/utils"

/**
 * Renders question/answer text, turning matrix literals like
 * `[[1, 2, 3], [4, 5, 6]]` into a proper bracketed matrix. Everything else is
 * shown as plain text. Only rectangular matrices (every row the same length,
 * no empty cells) are converted, so ordinary brackets in text are left alone.
 */

// [[...],[...],...] — inner rows contain no brackets
const MATRIX_PATTERN = /\[\s*\[[^[\]]*\](?:\s*,?\s*\[[^[\]]*\])*\s*\]/g

type Part = { type: "text"; value: string } | { type: "matrix"; rows: string[][] }

function parseMatrix(literal: string): string[][] | null {
  const rows = [...literal.matchAll(/\[([^[\]]*)\]/g)].map(m => m[1].split(",").map(cell => cell.trim()))
  if (rows.length === 0) return null
  const width = rows[0].length
  if (rows.some(row => row.length !== width || row.some(cell => cell === ""))) return null
  return rows
}

export function splitMath(text: string): Part[] {
  const parts: Part[] = []
  let last = 0
  for (const match of text.matchAll(MATRIX_PATTERN)) {
    const rows = parseMatrix(match[0])
    if (!rows) continue
    const start = match.index ?? 0
    if (start > last) parts.push({ type: "text", value: text.slice(last, start) })
    parts.push({ type: "matrix", rows })
    last = start + match[0].length
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) })
  return parts
}

export function Matrix({ rows, className }: { rows: string[][]; className?: string }) {
  const bracket = "pointer-events-none absolute inset-y-0 w-1.5 border-y-2 border-current"
  return (
    <span
      role="math"
      aria-label={`Matrix ${rows.map(r => r.join(", ")).join("; ")}`}
      className={cn("relative mx-1 inline-block max-w-full overflow-x-auto px-2.5 py-1 align-middle", className)}
    >
      <span aria-hidden="true" className={cn(bracket, "left-0 rounded-l-sm border-l-2")} />
      <span
        aria-hidden="true"
        className="inline-grid gap-x-4 gap-y-0.5 text-center font-normal tabular-nums leading-snug"
        style={{ gridTemplateColumns: `repeat(${rows[0].length}, auto)` }}
      >
        {rows.flatMap((row, r) => row.map((cell, c) => <span key={`${r}-${c}`}>{cell}</span>))}
      </span>
      <span aria-hidden="true" className={cn(bracket, "right-0 rounded-r-sm border-r-2")} />
    </span>
  )
}

export function MathText({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null
  const parts = splitMath(text)
  if (parts.length === 1 && parts[0].type === "text") return <>{text}</>
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === "text" ? <Fragment key={i}>{part.value}</Fragment> : <Matrix key={i} rows={part.rows} />
      )}
    </span>
  )
}
