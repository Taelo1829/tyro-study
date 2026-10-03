import { Fragment } from "react"
import { cn } from "@/lib/utils"

/**
 * Renders question/answer text, turning matrix literals like
 * `[[1, 2, 3], [4, 5, 6]]` (or LaTeX `\begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix}`)
 * into a proper bracketed matrix. Everything else is shown as plain text.
 * Only rectangular `[[…]]` literals (every row the same length, no empty
 * cells) are converted, so ordinary brackets in text are left alone.
 */

/** Bracket style: b [ ], p ( ), v | |, V ‖ ‖, B { }, none */
export type MatrixBracket = "b" | "p" | "v" | "V" | "B" | "none"

/**
 * Something to change in a piece of text:
 * - matrix: replace text[start, end) with a matrix
 * - text: replace text[start, end) with plain text (LaTeX delimiters/symbols)
 */
export type MathToken =
  | { type: "matrix"; start: number; end: number; rows: string[][]; bracket: MatrixBracket }
  | { type: "text"; start: number; end: number; value: string }

type Part = { type: "text"; value: string } | { type: "matrix"; rows: string[][]; bracket: MatrixBracket }

// U+0001 marks a block boundary when lesson HTML is flattened to text; nothing matches across it.
// [[...],[...],...] - inner rows contain no brackets
const BRACKET_MATRIX = String.raw`\[\s*\[[^[\]\u0001]*\](?:\s*,?\s*\[[^[\]\u0001]*\])*\s*\]`
// \begin{bmatrix} a & b \\ c & d \end{bmatrix} (also pmatrix, vmatrix, Vmatrix, Bmatrix, matrix, array)
const LATEX_MATRIX = String.raw`\\begin\{([pbBvV]?matrix|array)\}(?:\{[^}\u0001]*\})?([^\u0001]*?)\\end\{\1\}`
const MATRIX_PATTERN = new RegExp(`${BRACKET_MATRIX}|${LATEX_MATRIX}`, "g")
// \( … \), \[ … \], $$ … $$, and $ … $ only when it holds a LaTeX matrix
const DELIMITED = /\\\(([^\u0001]*?)\\\)|\\\[([^\u0001]*?)\\\]|\$\$([^\u0001]*?)\$\$|\$([^$\u0001]*?\\begin\{[^$\u0001]*?)\$/g

// Command names end at the first non-letter, so \cdot doesn't match inside \cdots
const cmd = (names: string) => new RegExp(String.raw`\\(?:${names})(?![a-zA-Z])\s*`, "g")
const LATEX_SYMBOLS: [RegExp, string][] = [
  [/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$1/$2"],
  [/\\(?:text|mathrm|mathbf|operatorname)\s*\{([^{}]*)\}/g, "$1"],
  [cmd("left|right"), ""],
  [cmd("times"), "× "],
  [cmd("cdots"), "⋯"],
  [cmd("cdot"), "· "],
  [cmd("ldots|dots"), "…"],
  [cmd("vdots"), "⋮"],
  [cmd("ddots"), "⋱"],
  [cmd("pm"), "±"],
  [cmd("neq?"), "≠ "],
  [cmd("leq?"), "≤ "],
  [cmd("geq?"), "≥ "],
  [cmd("lambda"), "λ"],
  [cmd("alpha"), "α"],
  [cmd("beta"), "β"],
  [cmd("theta"), "θ"],
  [cmd("det"), "det "],
  [/\\[,;:! ]|~/g, " "],
]

/** Light clean-up of a LaTeX snippet into readable text */
const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "-": "⁻", "+": "⁺", "(": "⁽", ")": "⁾", T: "ᵀ", n: "ⁿ", k: "ᵏ", i: "ⁱ", x: "ˣ",
}

/** "-1" → "⁻¹", or null when a character has no superscript form */
function toSuperscript(value: string): string | null {
  const chars = [...value.replace(/\s+/g, "")]
  return chars.length > 0 && chars.every(ch => SUPERSCRIPT[ch]) ? chars.map(ch => SUPERSCRIPT[ch]).join("") : null
}

/** A power: base character, then ^ and an exponent - x^2, λ^{n+1}, 2^(k-1), e^-x, A^T */
const POWER = /(?<=[\p{L}\p{N})\]}'′])\^(?:\{([^{}\n\u0001]+)\}|\(([^()\n\u0001]+)\)|(-?(?:\d+(?:\.\d+)?|\p{L}(?![\p{L}\d]))))/gu
/**
 * True when a code block is a program rather than maths written in code
 * style - there `x^2` means XOR, so it must stay as written.
 */
export function looksLikeProgram(text: string): boolean {
  return /[;{}]|==|<<|>>|\b(?:int|double|float|char|bool|string|void|return|cout|cin|printf|print|def|class|public|import|include|for|while|if|else|var|let|const|function)\b/.test(text)
}

export interface PowerToken { start: number; end: number; exponent: string }

/** Every power (x^2, x^{-1}, x^(n+1)) in a piece of text */
export function findPowers(text: string): PowerToken[] {
  if (!text.includes("^")) return []
  return [...text.matchAll(POWER)].map(m => ({
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
    exponent: (m[1] ?? m[2] ?? m[3] ?? "").trim(),
  }))
}

/** Powers in a short string as superscript characters where possible (for matrix cells) */
function superscriptPowers(value: string): string {
  return value.replace(POWER, (whole, a?: string, b?: string, c?: string) => toSuperscript((a ?? b ?? c ?? "").trim()) ?? whole)
}

function latexToText(value: string): string {
  let out = superscriptPowers(value)
  for (const [pattern, replacement] of LATEX_SYMBOLS) out = out.replace(pattern, replacement)
  return out.replace(/[{}]/g, "").replace(/\s+/g, " ")
}

function parseBracketMatrix(literal: string): string[][] | null {
  const rows = [...literal.matchAll(/\[([^[\]]*)\]/g)].map(m => m[1].split(",").map(cell => superscriptPowers(cell.replace(/\s+/g, " ").trim())))
  if (rows.length === 0) return null
  const width = rows[0].length
  if (rows.some(row => row.length !== width || row.some(cell => cell === ""))) return null
  return rows
}

function parseLatexMatrix(body: string): string[][] | null {
  const rows = body
    .split(/\\\\/)
    .map(row => row.replace(/\\hline/g, "").trim())
    .filter(row => row !== "")
    .map(row => row.split("&").map(cell => latexToText(cell).trim()))
  if (rows.length === 0) return null
  const width = Math.max(...rows.map(r => r.length))
  return rows.map(r => [...r, ...Array<string>(width - r.length).fill("")])
}

const LATEX_BRACKETS: Record<string, MatrixBracket> = {
  bmatrix: "b", pmatrix: "p", vmatrix: "v", Vmatrix: "V", Bmatrix: "B", matrix: "none", array: "none",
}

/** Matrices in text[from, to), with offsets relative to the whole text */
function matrixTokens(text: string, from = 0, to = text.length): MathToken[] {
  const tokens: MathToken[] = []
  const slice = text.slice(from, to)
  for (const match of slice.matchAll(MATRIX_PATTERN)) {
    const start = from + (match.index ?? 0)
    const end = start + match[0].length
    if (match[1]) {
      const rows = parseLatexMatrix(match[2] ?? "")
      if (rows) tokens.push({ type: "matrix", start, end, rows, bracket: LATEX_BRACKETS[match[1]] ?? "b" })
    } else {
      const rows = parseBracketMatrix(match[0])
      if (rows) tokens.push({ type: "matrix", start, end, rows, bracket: "b" })
    }
  }
  return tokens
}

/**
 * Find every matrix in a piece of text. Matrices inside LaTeX math
 * delimiters (\( \), \[ \], $$ $$) also drop the delimiters and turn common
 * LaTeX symbols (\times, \frac{a}{b}, …) in that span into plain text.
 * Tokens are in order and never overlap.
 */
export function findMath(text: string): MathToken[] {
  if (!text.includes("[") && !text.includes("\\begin")) return []
  const tokens: MathToken[] = []
  let last = 0
  for (const match of text.matchAll(DELIMITED)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    const inner = match[1] ?? match[2] ?? match[3] ?? match[4] ?? ""
    const innerStart = start + match[0].indexOf(inner)
    const innerEnd = innerStart + inner.length
    const inside = matrixTokens(text, innerStart, innerEnd)
    if (inside.length === 0) continue // ordinary maths - leave it alone
    tokens.push(...matrixTokens(text, last, start))
    // Opening delimiter, the text between matrices (cleaned), closing delimiter
    let cursor = innerStart
    tokens.push({ type: "text", start, end: innerStart, value: "" })
    for (const token of inside) {
      if (token.start > cursor) tokens.push({ type: "text", start: cursor, end: token.start, value: latexToText(text.slice(cursor, token.start)) })
      tokens.push(token)
      cursor = token.end
    }
    if (innerEnd > cursor) tokens.push({ type: "text", start: cursor, end: innerEnd, value: latexToText(text.slice(cursor, innerEnd)) })
    tokens.push({ type: "text", start: innerEnd, end, value: "" })
    last = end
  }
  tokens.push(...matrixTokens(text, last))
  return tokens
}

export function splitMath(text: string): Part[] {
  const parts: Part[] = []
  let last = 0
  for (const token of findMath(text)) {
    if (token.start > last) parts.push({ type: "text", value: text.slice(last, token.start) })
    if (token.type === "matrix") parts.push({ type: "matrix", rows: token.rows, bracket: token.bracket })
    else if (token.value) parts.push({ type: "text", value: token.value })
    last = token.end
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) })
  return parts
}

export function Matrix({ rows, bracket = "b", className }: { rows: string[][]; bracket?: MatrixBracket; className?: string }) {
  return (
    <span
      role="math"
      aria-label={`Matrix ${rows.map(r => r.join(", ")).join("; ")}`}
      className={cn("tc-matrix", bracket !== "b" && `tc-matrix-${bracket}`, className)}
    >
      <span
        aria-hidden="true"
        className="tc-matrix-grid font-normal"
        style={{ gridTemplateColumns: `repeat(${rows[0].length}, auto)` }}
      >
        {rows.flatMap((row, r) => row.map((cell, c) => <span key={`${r}-${c}`}>{cell}</span>))}
      </span>
    </span>
  )
}

/** Plain text with x^2 / x^{n+1} shown as superscripts */
function WithPowers({ text }: { text: string }) {
  const powers = findPowers(text)
  if (powers.length === 0) return <>{text}</>
  const out: React.ReactNode[] = []
  let last = 0
  powers.forEach((p, i) => {
    if (p.start > last) out.push(text.slice(last, p.start))
    out.push(<sup key={i}>{p.exponent}</sup>)
    last = p.end
  })
  if (last < text.length) out.push(text.slice(last))
  return <>{out}</>
}

export function MathText({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null
  const parts = splitMath(text)
  if (parts.length === 1 && parts[0].type === "text" && !text.includes("^")) return <>{text}</>
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === "text" ? <WithPowers key={i} text={part.value} /> : <Matrix key={i} rows={part.rows} bracket={part.bracket} />
      )}
    </span>
  )
}
