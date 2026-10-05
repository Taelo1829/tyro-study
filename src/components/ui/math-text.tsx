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

export interface FractionToken { start: number; end: number; numerator: string; denominator: string }

// One side of a fraction: a number (3, 0.5), a single lowercase letter (x, y, λ) or both (2x),
// either with an optional power (x^2), or a short bracketed expression ((a+b)).
const FRACTION_SIDE = String.raw`(?:\d+(?:\.\d+)?(?:[a-zα-ω](?![\p{L}\p{N}]))?|[a-zα-ω](?![\p{L}\p{N}]))(?:\^(?:\{[^{}\n\u0001]+\}|\([^()\n\u0001]+\)|-?[\p{L}\p{N}]+))?|\([^()\n\u0001]{1,40}\)`
/** a/b, x/y, 3/4, x^2/y, (a+b)/(c-d) - not dates (1/2/2024), paths, URLs or words (and/or) */
const FRACTION = new RegExp(String.raw`(?<![\p{L}\p{N}_/.:\\])(${FRACTION_SIDE}) ?\/ ?(${FRACTION_SIDE})(?![\p{L}\p{N}_/])`, "gu")
/** Slashed abbreviations that aren't fractions */
const NOT_FRACTIONS = new Set(["n/a", "w/o", "c/o", "a/c", "w/e", "b/w", "s/o", "y/n", "24/7"])

const unbracket = (side: string) => (/^\(.*\)$/.test(side) ? side.slice(1, -1).trim() : side)

/** Every fraction written with a slash (3/4, x/y, (a+b)/c) in a piece of text */
export function findFractions(text: string): FractionToken[] {
  if (!text.includes("/")) return []
  const out: FractionToken[] = []
  for (const m of text.matchAll(FRACTION)) {
    if (NOT_FRACTIONS.has(m[0].replace(/\s+/g, "").toLowerCase())) continue
    out.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, numerator: unbracket(m[1]), denominator: unbracket(m[2]) })
  }
  return out
}

// ---------------------------------------------------------------- subscripts

/** x_1, x_{12}, a_{ij}: an underscore after a single letter (not snake_case words) */
const SUBSCRIPT = /(?<=(?:^|[^\p{L}_])\p{L})_(?:\{([^{}\n\u0001]+)\}|(\p{N}{1,3}(?![\p{L}\p{N}])|\p{L}{1,2}(?![\p{L}\p{N}])))/gu
/** (AB)_{ij}, [A]_{ij}, ∫_{0}^{1}: a braced subscript after a bracket or an integral sign */
const BRACKET_SUBSCRIPT = /(?<=[)\]∫∮])_(?:\{([^{}\n\u0001]+)\}|(\p{N}{1,3}(?![\p{L}\p{N}])|\p{L}(?![\p{L}\p{N}])))/gu
/** x1, a12 typed without the underscore: a lone lowercase letter followed by 1–2 digits */
const PLAIN_SUBSCRIPT = /(?<=(?:^|[^\p{L}_.])[a-z])(\d{1,2})(?![\p{L}\p{N}_])/gu
/** The text reads as maths (an equation or expression), so x1 means x₁ */
const MATHS_SIGNS = /[=+±≤≥<>−×·]|\s-\s/

/**
 * Stricter than looksLikeProgram (which also catches words like "for" and
 * "if" in a maths question): real code structure only.
 */
const CODE = /[;{}]|==|<<|>>|#include|\b(?:for|while|if|switch)\s*\(|\b(?:int|double|float|char|bool|string|void|var|let|const|auto)\s+[A-Za-z_]\w*\s*[=;,()[]|\b(?:cout|cin|printf|print|console\.log)\s*[(<]|\bdef\s+\w+\s*\(|\breturn\b/
function looksLikeCode(text: string) {
  return CODE.test(text)
}

export interface SubscriptToken { start: number; end: number; value: string }

/**
 * Subscripts in a piece of text: x_1, a_{ij} always; x1 + x2 = 0 when the text
 * reads as maths (an operator, or several such variables). Programs are left
 * alone: there x1 and my_var are names.
 */
export function findSubscripts(text: string): SubscriptToken[] {
  // (the braces in a_{ij} and x^{n+1} aren't code)
  if (looksLikeCode(text.replace(/[_^]\{[^{}]*\}/g, ""))) return []
  const out: SubscriptToken[] = [...text.matchAll(SUBSCRIPT), ...text.matchAll(BRACKET_SUBSCRIPT)].map(m => ({
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
    value: (m[1] ?? m[2] ?? "").trim(),
  }))
  const plain = [...text.matchAll(PLAIN_SUBSCRIPT)]
  if (plain.length >= 2 || (plain.length === 1 && MATHS_SIGNS.test(text))) {
    for (const m of plain) out.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, value: m[1] })
  }
  return out.sort((a, b) => a.start - b.start)
}

export type ScriptToken =
  | { start: number; end: number; kind: "sup" | "sub"; value: string }
  | { start: number; end: number; kind: "op"; symbol: string; lower: string; upper: string }

/**
 * A sum or product with its limits: ∑_{k=1}^{n}, ∏_{i=1}^{m}, \sum_{k=1}^n, and
 * Σ_{k=1}^{n} (a capital sigma only with both limits, since Σ_1 can be a name).
 */
const BIG_OPERATOR =
  /(∑|∏|\\sum(?![a-zA-Z])|\\prod(?![a-zA-Z])|Σ(?=_[^\n]*?\^)|Π(?=_[^\n]*?\^))\s?(?:_(?:\{([^{}\n\u0001]+)\}|([\p{L}\p{N}]+(?:=[\p{L}\p{N}]+)?)))?(?:\^(?:\{([^{}\n\u0001]+)\}|([\p{L}\p{N}]+|∞)))?/gu
const OPERATOR_SYMBOL: Record<string, string> = { "\\sum": "∑", "\\prod": "∏", Σ: "∑", Π: "∏" }

export function findBigOperators(text: string): ScriptToken[] {
  if (!/[∑∏ΣΠ]|\\sum|\\prod/.test(text)) return []
  const out: ScriptToken[] = []
  for (const m of text.matchAll(BIG_OPERATOR)) {
    const lower = (m[2] ?? m[3] ?? "").trim()
    const upper = (m[4] ?? m[5] ?? "").trim()
    if (!lower && !upper && !m[1].startsWith("\\")) continue // a plain ∑ needs nothing
    if ((m[1] === "Σ" || m[1] === "Π") && !(lower && upper)) continue
    out.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, kind: "op", symbol: OPERATOR_SYMBOL[m[1]] ?? m[1], lower, upper })
  }
  return out
}

/** Sums with limits, powers and subscripts together, in order, without overlaps */
export function findScripts(text: string): ScriptToken[] {
  const all: ScriptToken[] = [
    ...findBigOperators(text),
    ...findPowers(text).map(p => ({ start: p.start, end: p.end, kind: "sup" as const, value: p.exponent })),
    ...findSubscripts(text).map(s => ({ ...s, kind: "sub" as const })),
  ].sort((a, b) => a.start - b.start)
  const out: ScriptToken[] = []
  for (const t of all) if (!out.length || t.start >= out[out.length - 1].end) out.push(t)
  return out
}

/** Could this text hold a power or subscript? (cheap pre-check) */
export function mayHaveScripts(text: string) {
  return text.includes("^") || text.includes("_") || /[a-z]\d|[∑∏]|\\sum|\\prod/.test(text)
}

const SUBSCRIPT_CHARS: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", i: "ᵢ", j: "ⱼ", k: "ₖ", n: "ₙ", m: "ₘ", o: "ₒ", x: "ₓ",
}

function toSubscript(value: string): string | null {
  const chars = [...value.replace(/\s+/g, "")]
  return chars.length > 0 && chars.every(ch => SUBSCRIPT_CHARS[ch]) ? chars.map(ch => SUBSCRIPT_CHARS[ch]).join("") : null
}

/** Powers in a short string as superscript characters where possible (for matrix cells) */
function superscriptPowers(value: string): string {
  return value.replace(POWER, (whole, a?: string, b?: string, c?: string) => toSuperscript((a ?? b ?? c ?? "").trim()) ?? whole)
}

function latexToText(value: string): string {
  let out = cellScripts(value)
  for (const [pattern, replacement] of LATEX_SYMBOLS) out = out.replace(pattern, replacement)
  return out.replace(/[{}]/g, "").replace(/\s+/g, " ")
}

/** A matrix cell: powers and subscripts as small characters where possible (a_{11} → a₁₁) */
function cellScripts(value: string): string {
  let out = superscriptPowers(value)
  for (const t of findSubscripts(out).reverse()) {
    const small = toSubscript(t.value)
    if (small) out = out.slice(0, t.start) + small + out.slice(t.end)
  }
  return out
}

function parseBracketMatrix(literal: string): string[][] | null {
  const rows = [...literal.matchAll(/\[([^[\]]*)\]/g)].map(m => m[1].split(",").map(cell => cellScripts(cell.replace(/\s+/g, " ").trim())))
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

/** Plain text with fractions stacked (numerator over denominator) and powers raised */
function WithMath({ text }: { text: string }) {
  const fractions = looksLikeProgram(text) ? [] : findFractions(text)
  if (fractions.length === 0) return <WithPowers text={text} />
  const out: React.ReactNode[] = []
  let last = 0
  fractions.forEach((f, i) => {
    if (f.start > last) out.push(<WithPowers key={`t${i}`} text={text.slice(last, f.start)} />)
    out.push(<Fraction key={`f${i}`} numerator={f.numerator} denominator={f.denominator} />)
    last = f.end
  })
  if (last < text.length) out.push(<WithPowers key="end" text={text.slice(last)} />)
  return <>{out}</>
}

export function Fraction({ numerator, denominator }: { numerator: string; denominator: string }) {
  return (
    <span className="tc-frac" role="math" aria-label={`${numerator} over ${denominator}`}>
      <span className="tc-frac-num" aria-hidden="true"><WithPowers text={numerator} /></span>
      <span className="tc-frac-den" aria-hidden="true"><WithPowers text={denominator} /></span>
    </span>
  )
}

/** Plain text with x^2 / x^{n+1} shown as superscripts */
function WithPowers({ text }: { text: string }) {
  const scripts = mayHaveScripts(text) ? findScripts(text) : []
  if (scripts.length === 0) return <>{text}</>
  const out: React.ReactNode[] = []
  let last = 0
  scripts.forEach((p, i) => {
    if (p.start > last) out.push(text.slice(last, p.start))
    out.push(
      p.kind === "op" ? <BigOperator key={i} {...p} /> : p.kind === "sup" ? <sup key={i}>{p.value}</sup> : <sub key={i}>{p.value}</sub>
    )
    last = p.end
  })
  if (last < text.length) out.push(text.slice(last))
  return <>{out}</>
}

/** ∑ with its limits above and below, as in print */
function BigOperator({ symbol, lower, upper }: { symbol: string; lower: string; upper: string }) {
  const label = `${symbol === "∏" ? "product" : "sum"}${lower ? ` from ${lower}` : ""}${upper ? ` to ${upper}` : ""}`
  return (
    <span className="tc-op" role="math" aria-label={label}>
      <span className="tc-op-upper" aria-hidden="true">{upper || "\u00a0"}</span>
      <span className="tc-op-symbol" aria-hidden="true">{symbol}</span>
      <span className="tc-op-lower" aria-hidden="true">{lower || "\u00a0"}</span>
    </span>
  )
}

export function MathText({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null
  const parts = splitMath(text)
  if (parts.length === 1 && parts[0].type === "text" && !mayHaveScripts(text) && !text.includes("/")) return <>{text}</>
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === "text" ? <WithMath key={i} text={part.value} /> : <Matrix key={i} rows={part.rows} bracket={part.bracket} />
      )}
    </span>
  )
}
