/**
 * Maths graphs for lessons, drawn by code (never by the AI).
 *
 * The lesson writer describes a graph with a marker:
 *
 *   <div class="graph" data-fn="x^2 - 4x + 3 | 2x - 1" data-x="-1,5" data-y="-3,8"
 *        data-points="1,0: A(1, 0) | 3,0: B(3, 0) | 2,-1: Turning point (2, -1)"
 *        data-asymptotes="x = 2 | y = 1" data-shade="y > 2x - 1"
 *        data-angle="degrees">The graph of f(x) = x² − 4x + 3</div>
 *
 * Every attribute except data-fn is optional. Lists are separated by "|".
 * renderGraphSvg() turns the attributes into an SVG, so every point on a
 * curve really is on the function the AI wrote.
 *
 * Expressions are parsed by a small parser (no eval): numbers, x, + − × ÷ ^,
 * brackets, implicit multiplication (4x, 2(x+1), 3sin(x)), pi, e and the
 * functions sin cos tan asin acos atan sqrt cbrt abs ln log exp.
 */

// ── Expression parser ────────────────────────────────────────────────────────

export type Fn = (x: number) => number

type Token =
  | { t: "num"; v: number }
  | { t: "var" }
  | { t: "const"; v: number }
  | { t: "fn"; name: string }
  | { t: "op"; v: "+" | "-" | "*" | "/" | "^" }
  | { t: "(" }
  | { t: ")" }

const FUNCTION_NAMES = ["asin", "acos", "atan", "sqrt", "cbrt", "sin", "cos", "tan", "abs", "exp", "log", "ln"]

/** Unicode and textbook spellings → plain ASCII the parser understands */
export function normaliseExpression(input: string): string {
  return input
    .replace(/[−–—]/g, "-")
    .replace(/[×·∙]/g, "*")
    .replace(/÷/g, "/")
    .replace(/π/g, "pi")
    .replace(/√\s*\(/g, "sqrt(")
    .replace(/√\s*([\d.]+|x)/g, "sqrt($1)")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/\*\*/g, "^")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .replace(/\s+/g, " ")
    .trim()
    // "y = …", "f(x) = …", "g(x)=…": keep the right-hand side
    .replace(/^(?:y|[a-z]\s*\(\s*x\s*\))\s*=\s*/i, "")
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === " ") {
      i++
    } else if (/[\d.]/.test(ch)) {
      const m = /^\d*\.?\d+(?:e[+-]?\d+)?|^\d+\.?/i.exec(src.slice(i))!
      tokens.push({ t: "num", v: parseFloat(m[0]) })
      i += m[0].length
    } else if (/[a-z]/i.test(ch)) {
      // A run of letters: split into known names and single x's ("xsin" → x, sin)
      let word = /^[a-z]+/i.exec(src.slice(i))![0].toLowerCase()
      i += word.length
      while (word) {
        const fn = FUNCTION_NAMES.find(n => word.startsWith(n))
        if (fn) {
          tokens.push({ t: "fn", name: fn })
          word = word.slice(fn.length)
        } else if (word.startsWith("pi")) {
          tokens.push({ t: "const", v: Math.PI })
          word = word.slice(2)
        } else if (word[0] === "e") {
          tokens.push({ t: "const", v: Math.E })
          word = word.slice(1)
        } else if (word[0] === "x") {
          tokens.push({ t: "var" })
          word = word.slice(1)
        } else {
          throw new Error(`Unknown name "${word}"`)
        }
      }
    } else if ("+-*/^".includes(ch)) {
      tokens.push({ t: "op", v: ch as "+" | "-" | "*" | "/" | "^" })
      i++
    } else if (ch === "(" || ch === ")") {
      tokens.push({ t: ch })
      i++
    } else {
      throw new Error(`Unexpected "${ch}"`)
    }
  }

  // Implicit multiplication: 4x, 2(x+1), (x-1)(x+2), x sin(x), 2pi
  const out: Token[] = []
  for (const tok of tokens) {
    const prev = out[out.length - 1]
    const prevEndsValue = prev && (prev.t === "num" || prev.t === "var" || prev.t === "const" || prev.t === ")")
    const startsValue = tok.t === "num" || tok.t === "var" || tok.t === "const" || tok.t === "fn" || tok.t === "("
    if (prevEndsValue && startsValue) out.push({ t: "op", v: "*" })
    out.push(tok)
  }
  return out
}

/**
 * Compile an expression in x to a function.
 * `degrees`: trig functions take (and inverse trig return) degrees.
 * Throws on anything it can't read.
 */
export function compileExpression(input: string, { degrees = false } = {}): Fn {
  const tokens = tokenize(normaliseExpression(input))
  if (tokens.length === 0) throw new Error("Empty expression")
  let pos = 0
  const peek = () => tokens[pos]
  const isOp = (v: string) => {
    const tok = peek()
    return tok?.t === "op" && tok.v === v
  }

  const toRad = degrees ? (v: number) => (v * Math.PI) / 180 : (v: number) => v
  const fromRad = degrees ? (v: number) => (v * 180) / Math.PI : (v: number) => v
  const FUNCS: Record<string, (v: number) => number> = {
    sin: v => Math.sin(toRad(v)),
    cos: v => Math.cos(toRad(v)),
    tan: v => {
      // tan is undefined at 90°, 270°…: return NaN instead of a huge number
      const r = toRad(v)
      return Math.abs(Math.cos(r)) < 1e-12 ? NaN : Math.tan(r)
    },
    asin: v => fromRad(Math.asin(v)),
    acos: v => fromRad(Math.acos(v)),
    atan: v => fromRad(Math.atan(v)),
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    abs: Math.abs,
    exp: Math.exp,
    ln: Math.log,
    log: Math.log10,
  }

  // expr := term (("+" | "-") term)*
  const expr = (): Fn => {
    let left = term()
    while (isOp("+") || isOp("-")) {
      const op = (tokens[pos++] as { v: string }).v
      const a = left
      const b = term()
      left = op === "+" ? x => a(x) + b(x) : x => a(x) - b(x)
    }
    return left
  }
  // term := unary (("*" | "/") unary)*
  const term = (): Fn => {
    let left = unary()
    while (isOp("*") || isOp("/")) {
      const op = (tokens[pos++] as { v: string }).v
      const a = left
      const b = unary()
      left = op === "*" ? x => a(x) * b(x) : x => a(x) / b(x)
    }
    return left
  }
  // unary := ("-" | "+") unary | power      (so -x^2 = -(x^2))
  const unary = (): Fn => {
    if (isOp("-")) {
      pos++
      const a = unary()
      return x => -a(x)
    }
    if (isOp("+")) {
      pos++
      return unary()
    }
    return power()
  }
  // power := primary ("^" unary)?           (right-associative: 2^3^2 = 2^9)
  const power = (): Fn => {
    const base = primary()
    if (isOp("^")) {
      pos++
      const exp = unary()
      return x => {
        const b = base(x)
        const n = exp(x)
        // Odd roots of negatives, e.g. x^(1/3) for x < 0
        if (b < 0 && !Number.isInteger(n)) {
          const inv = 1 / n
          if (Number.isInteger(Math.round(inv)) && Math.abs(inv - Math.round(inv)) < 1e-9 && Math.round(inv) % 2 !== 0) {
            return -Math.pow(-b, n)
          }
        }
        return Math.pow(b, n)
      }
    }
    return base
  }
  const primary = (): Fn => {
    const tok = tokens[pos++]
    if (!tok) throw new Error("Expression ends too early")
    if (tok.t === "num" || tok.t === "const") {
      const v = tok.v
      return () => v
    }
    if (tok.t === "var") return x => x
    if (tok.t === "(") {
      const inner = expr()
      if (peek()?.t !== ")") throw new Error("Missing )")
      pos++
      return inner
    }
    if (tok.t === "fn") {
      const f = FUNCS[tok.name]
      // sin(x)^2 means (sin x)^2, so a bracketed argument stops before "^";
      // without brackets (sin x) the argument is the next power
      const arg = peek()?.t === "(" ? primary() : power()
      return x => f(arg(x))
    }
    throw new Error("Unexpected symbol")
  }

  const fn = expr()
  if (pos !== tokens.length) throw new Error("Unexpected text after the expression")
  return fn
}

// ── Graph spec ───────────────────────────────────────────────────────────────

export interface GraphSpec {
  fn?: string
  x?: string
  y?: string
  points?: string
  asymptotes?: string
  shade?: string
  angle?: string
}

const list = (value: string | undefined) =>
  (value ?? "")
    .split("|")
    .map(s => s.trim())
    .filter(Boolean)

function range(value: string | undefined, compileOpts: { degrees: boolean }): [number, number] | null {
  if (!value) return null
  const parts = splitTopLevelComma(value.replace(/^\[|\]$/g, ""))
  if (parts.length !== 2) return null
  try {
    const a = compileExpression(parts[0], compileOpts)(0)
    const b = compileExpression(parts[1], compileOpts)(0)
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return null
    return a < b ? [a, b] : [b, a]
  } catch {
    return null
  }
}

/** "1, 2" → ["1", "2"]; commas inside brackets (sqrt(…)) are kept */
function splitTopLevelComma(value: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ""
  for (const ch of value) {
    if (ch === "(") depth++
    if (ch === ")") depth--
    if ((ch === "," || ch === ";") && depth === 0) {
      parts.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  parts.push(current)
  return parts.map(p => p.trim()).filter(p => p !== "")
}

/** Nice tick step for a range: 1, 2 or 5 × 10^n, about 6–10 ticks */
function niceStep(span: number, target = 8) {
  const raw = span / target
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10
  return nice * mag
}

const fmt = (n: number) => {
  const r = Math.round(n * 1e6) / 1e6
  return (Object.is(r, -0) ? 0 : r).toString().replace("-", "−")
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** x^2 → x², 2*x → 2x, - → − for display */
export function prettyExpression(src: string): string {
  const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" }
  return src
    .replace(/\^\(?(-?\d+)\)?/g, (_, d: string) => [...d].map(c => SUP[c] ?? c).join(""))
    .replace(/\^x\b/g, "ˣ")
    .replace(/\^\(-x\)/g, "⁻ˣ")
    .replace(/(\d)\s*\*\s*(?=[a-z(])/gi, "$1")
    .replace(/\*/g, "·")
    .replace(/sqrt/g, "√")
    .replace(/\bpi\b/g, "π")
    .replace(/ - /g, " − ")
    .replace(/^-/, "−")
}

const COLOURS = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c"]

const W = 560
const H = 400
const PAD = { left: 40, right: 16, top: 16, bottom: 32 }

let graphCounter = 0

/**
 * Draw a graph as SVG markup, or return null when the spec can't be drawn
 * (no readable function, bad ranges). Pure string output: works on the server
 * and in the browser.
 */
export function renderGraphSvg(spec: GraphSpec, title = "Graph"): string | null {
  const degrees = /deg/i.test(spec.angle ?? "")
  const opts = { degrees }

  // Functions (skip any the parser can't read, but need at least one thing to draw)
  const fns: { label: string; f: Fn }[] = []
  for (const src of list(spec.fn)) {
    try {
      const f = compileExpression(src, opts)
      f(1) // throws early on broken trees
      fns.push({ label: src, f })
    } catch {
      /* skip unreadable function */
    }
  }

  // Asymptotes: "x = 2" (vertical) or "y = …" (horizontal or oblique)
  const vLines: number[] = []
  const dashed: Fn[] = []
  for (const a of list(spec.asymptotes)) {
    try {
      const vertical = /^\s*x\s*=\s*(.+)$/i.exec(a)
      if (vertical) {
        const v = compileExpression(vertical[1], opts)(0)
        if (Number.isFinite(v)) vLines.push(v)
      } else {
        dashed.push(compileExpression(a, opts)) // "y = 1" or "y = x + 1"
      }
    } catch {
      /* skip unreadable asymptote */
    }
  }

  // Points: "x,y: label"
  const points: { x: number; y: number; label: string }[] = []
  for (const p of list(spec.points)) {
    const colon = p.indexOf(":")
    let coords = (colon >= 0 ? p.slice(0, colon) : p).trim()
    // "(1, 2)" → "1, 2", but leave "3-sqrt(5), 1" alone
    if (coords.startsWith("(") && coords.endsWith(")") && splitTopLevelComma(coords.slice(1, -1)).length === 2) coords = coords.slice(1, -1)
    const label = colon >= 0 ? p.slice(colon + 1).trim() : ""
    const parts = splitTopLevelComma(coords)
    if (parts.length !== 2) continue
    try {
      const x = compileExpression(parts[0], opts)(0)
      const y = compileExpression(parts[1], opts)(0)
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y, label: label || `(${fmt(x)}, ${fmt(y)})` })
    } catch {
      /* skip */
    }
  }

  // Shading: "y > 2x - 1", "y <= x^2"
  const shades: { f: Fn; above: boolean }[] = []
  for (const s of list(spec.shade)) {
    const m = /^\s*y\s*(>=|<=|>|<|≥|≤)\s*(.+)$/i.exec(s)
    if (!m) continue
    try {
      shades.push({ f: compileExpression(m[2], opts), above: m[1] === ">" || m[1] === ">=" || m[1] === "≥" })
    } catch {
      /* skip */
    }
  }

  if (fns.length === 0 && points.length === 0 && shades.length === 0) return null

  // Ranges: x from the spec (default −5…5, or −360…360 in degrees); y from the spec or the curves
  const [x0, x1] = range(spec.x, opts) ?? (degrees ? [-360, 360] : [-5, 5])
  let yr = range(spec.y, opts)
  if (!yr) {
    const ys: number[] = points.map(p => p.y)
    for (const { f } of fns) {
      for (let i = 0; i <= 200; i++) {
        const y = f(x0 + ((x1 - x0) * i) / 200)
        if (Number.isFinite(y)) ys.push(y)
      }
    }
    ys.sort((a, b) => a - b)
    // Ignore the extreme 5% at each end so asymptotes don't flatten the picture
    const lo = ys.length ? ys[Math.floor(ys.length * 0.05)] : -5
    const hi = ys.length ? ys[Math.ceil(ys.length * 0.95) - 1] : 5
    const pad = Math.max((hi - lo) * 0.15, 1)
    yr = [Math.min(lo - pad, 0 - pad * 0.3), Math.max(hi + pad, 0 + pad * 0.3)]
  }
  const [y0, y1] = yr

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const sx = (x: number) => PAD.left + ((x - x0) / (x1 - x0)) * plotW
  const sy = (y: number) => PAD.top + ((y1 - y) / (y1 - y0)) * plotH
  const n = (v: number) => Math.round(v * 10) / 10

  const id = `g${++graphCounter}`
  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}" class="lesson-graph" font-family="inherit" font-size="12">`,
    `<defs><clipPath id="${id}-clip"><rect x="${PAD.left}" y="${PAD.top}" width="${plotW}" height="${plotH}"/></clipPath>`,
    `<marker id="${id}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#334155"/></marker></defs>`,
    `<rect x="${PAD.left}" y="${PAD.top}" width="${plotW}" height="${plotH}" fill="#ffffff"/>`
  )

  // Grid and tick labels
  const xStep = degrees && x1 - x0 >= 180 ? (x1 - x0 >= 360 ? 90 : 45) : niceStep(x1 - x0)
  const yStep = niceStep(y1 - y0)
  const axisY = y0 <= 0 && y1 >= 0 ? sy(0) : y0 > 0 ? sy(y0) : sy(y1)
  const axisX = x0 <= 0 && x1 >= 0 ? sx(0) : x0 > 0 ? sx(x0) : sx(x1)
  const grid: string[] = []
  const labels: string[] = []
  for (let v = Math.ceil(x0 / xStep) * xStep; v <= x1 + 1e-9; v += xStep) {
    const px = n(sx(v))
    grid.push(`M${px},${PAD.top}V${PAD.top + plotH}`)
    // No label at 0 (the origin has "O") or under the x-axis arrow
    if (Math.abs(v) > 1e-9 && px < PAD.left + plotW - 14) {
      const ty = Math.min(axisY + 15, PAD.top + plotH + 15)
      labels.push(`<text x="${px}" y="${n(ty)}" text-anchor="middle" fill="#475569">${fmt(v)}${degrees ? "°" : ""}</text>`)
    }
  }
  for (let v = Math.ceil(y0 / yStep) * yStep; v <= y1 + 1e-9; v += yStep) {
    const py = n(sy(v))
    grid.push(`M${PAD.left},${py}H${PAD.left + plotW}`)
    // No label at 0 or beside the y-axis arrow
    if (Math.abs(v) > 1e-9 && py > PAD.top + 14) {
      const tx = Math.max(axisX - 6, PAD.left - 6)
      labels.push(`<text x="${n(tx)}" y="${py + 4}" text-anchor="end" fill="#475569">${fmt(v)}</text>`)
    }
  }
  parts.push(`<path d="${grid.join("")}" stroke="#e2e8f0" stroke-width="1" fill="none"/>`)

  // Shaded regions (under everything else)
  for (const { f, above } of shades) {
    const edge = above ? PAD.top : PAD.top + plotH
    let d = `M${n(sx(x0))},${edge}`
    for (let i = 0; i <= 300; i++) {
      const x = x0 + ((x1 - x0) * i) / 300
      const y = f(x)
      const py = Number.isFinite(y) ? Math.max(PAD.top - 5, Math.min(PAD.top + plotH + 5, sy(y))) : edge
      d += `L${n(sx(x))},${n(py)}`
    }
    d += `L${n(sx(x1))},${edge}Z`
    parts.push(`<path d="${d}" fill="#2563eb" fill-opacity="0.12" stroke="none" clip-path="url(#${id}-clip)"/>`)
  }

  // Axes with arrows, and the origin
  parts.push(
    `<line x1="${PAD.left}" y1="${n(axisY)}" x2="${PAD.left + plotW}" y2="${n(axisY)}" stroke="#334155" stroke-width="1.3" marker-end="url(#${id}-arrow)"/>`,
    `<line x1="${n(axisX)}" y1="${PAD.top + plotH}" x2="${n(axisX)}" y2="${PAD.top}" stroke="#334155" stroke-width="1.3" marker-end="url(#${id}-arrow)"/>`,
    `<text x="${PAD.left + plotW - 4}" y="${n(axisY) - 7}" text-anchor="end" font-style="italic" fill="#334155">x</text>`,
    `<text x="${n(axisX) + 8}" y="${PAD.top + 11}" font-style="italic" fill="#334155">y</text>`
  )
  if (x0 <= 0 && x1 >= 0 && y0 <= 0 && y1 >= 0) {
    parts.push(`<text x="${n(sx(0)) - 5}" y="${n(sy(0)) + 14}" text-anchor="end" fill="#475569">O</text>`)
  }
  parts.push(...labels)

  // Curves: sample densely and break the line at gaps and jumps (hyperbolas, tan)
  const curve = (f: Fn) => {
    const SAMPLES = 800
    const jump = (y1 - y0) * 2
    let d = ""
    let prev: number | null = null
    for (let i = 0; i <= SAMPLES; i++) {
      const x = x0 + ((x1 - x0) * i) / SAMPLES
      const y = f(x)
      if (!Number.isFinite(y) || Math.abs(y) > 1e7) {
        prev = null
        continue
      }
      const cy = Math.max(y0 - (y1 - y0), Math.min(y1 + (y1 - y0), y))
      if (prev === null || Math.abs(y - prev) > jump) d += `M${n(sx(x))},${n(sy(cy))}`
      else d += `L${n(sx(x))},${n(sy(cy))}`
      prev = y
    }
    return d
  }

  for (const v of vLines) {
    if (v >= x0 && v <= x1) {
      parts.push(`<line x1="${n(sx(v))}" y1="${PAD.top}" x2="${n(sx(v))}" y2="${PAD.top + plotH}" stroke="#64748b" stroke-width="1.3" stroke-dasharray="6 5"/>`)
    }
  }
  for (const f of dashed) {
    parts.push(`<path d="${curve(f)}" fill="none" stroke="#64748b" stroke-width="1.3" stroke-dasharray="6 5" clip-path="url(#${id}-clip)"/>`)
  }
  fns.forEach(({ f }, i) => {
    parts.push(`<path d="${curve(f)}" fill="none" stroke="${COLOURS[i % COLOURS.length]}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" clip-path="url(#${id}-clip)"/>`)
  })

  // Points and their labels (kept inside the plot area). A point that isn't on
  // any of the curves is a mistake in the AI's working: leave it out rather
  // than show a wrong intercept or turning point.
  const tolerance = (y1 - y0) * 0.015
  const onACurve = (p: { x: number; y: number }) =>
    fns.length === 0 || [...fns.map(f => f.f), ...dashed].some(f => Math.abs(f(p.x) - p.y) <= tolerance)
  for (const p of points) {
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue
    if (!onACurve(p)) continue
    const px = n(sx(p.x))
    const py = n(sy(p.y))
    const right = px < PAD.left + plotW * 0.7
    const below = py < PAD.top + 22
    parts.push(
      `<circle cx="${px}" cy="${py}" r="4" fill="#0f172a" stroke="#ffffff" stroke-width="1.5"/>`,
      `<text x="${right ? px + 8 : px - 8}" y="${below ? py + 18 : py - 8}" text-anchor="${right ? "start" : "end"}" fill="#0f172a" font-weight="600" paint-order="stroke" stroke="#ffffff" stroke-width="3">${esc(p.label)}</text>`
    )
  }

  // Key: which colour is which function (only needed for 2+ functions, but helpful for 1 too)
  if (fns.length) {
    const rowH = 18
    const longest = Math.max(...fns.map(f => prettyExpression(normaliseExpression(f.label)).length))
    const boxW = Math.min(plotW - 16, 34 + longest * 6.6)
    const boxH = fns.length * rowH + 8
    // Top-left or top-right, whichever the curves and points cross least
    const crowding = (left: number) => {
      let hits = 0
      for (const { f } of fns) {
        for (let i = 0; i <= 120; i++) {
          const x = x0 + ((x1 - x0) * i) / 120
          const px = sx(x)
          const py = sy(f(x))
          if (px >= left - 6 && px <= left + boxW + 6 && py >= PAD.top && py <= PAD.top + 8 + boxH + 6) hits++
        }
      }
      for (const p of points) {
        const px = sx(p.x)
        const py = sy(p.y)
        if (px >= left - 30 && px <= left + boxW + 30 && py <= PAD.top + 8 + boxH + 24) hits += 20
      }
      // Don't cover the top of the y-axis and its "y"
      if (axisX >= left - 16 && axisX <= left + boxW + 16) hits += 15
      return hits
    }
    const leftX = PAD.left + 8
    const rightX = PAD.left + plotW - 8 - boxW
    const kx = crowding(rightX) < crowding(leftX) ? rightX : leftX
    const ky = PAD.top + 8
    parts.push(`<rect x="${n(kx)}" y="${ky}" width="${n(boxW)}" height="${boxH}" rx="6" fill="#ffffff" fill-opacity="0.92" stroke="#e2e8f0"/>`)
    fns.forEach((f, i) => {
      const y = ky + 4 + rowH * i + rowH / 2
      parts.push(
        `<line x1="${kx + 8}" y1="${n(y)}" x2="${kx + 24}" y2="${n(y)}" stroke="${COLOURS[i % COLOURS.length]}" stroke-width="2.4" stroke-linecap="round"/>`,
        `<text x="${kx + 30}" y="${n(y + 4)}" fill="#0f172a">${esc("y = " + prettyExpression(normaliseExpression(f.label)))}</text>`
      )
    })
  }

  parts.push(`</svg>`)
  return parts.join("")
}

// ── Lesson markers ───────────────────────────────────────────────────────────

export const GRAPH_ATTRIBUTES = ["data-fn", "data-x", "data-y", "data-points", "data-asymptotes", "data-shade", "data-angle"] as const

/** Read a graph marker's settings, given a way to get an attribute */
export function graphSpecFrom(get: (name: string) => string | null | undefined): GraphSpec {
  return {
    fn: get("data-fn") ?? undefined,
    x: get("data-x") ?? undefined,
    y: get("data-y") ?? undefined,
    points: get("data-points") ?? undefined,
    asymptotes: get("data-asymptotes") ?? undefined,
    shade: get("data-shade") ?? undefined,
    angle: get("data-angle") ?? undefined,
  }
}

const decodeEntities = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")

/**
 * String version for server-rendered pages: replace each
 * <div class="graph" data-…>caption</div> with the drawn graph. Markers that
 * can't be drawn are removed (the lesson text never depends on them).
 */
export function renderGraphMarkersInHtml(html: string): string {
  return html.replace(/<div\b(?=[^>]*\bclass\s*=\s*["']graph["'])([^>]*)>([\s\S]*?)<\/div>/gi, (_, attrs: string, caption: string) => {
    const values = new Map<string, string>()
    for (const m of attrs.matchAll(/\b(data-[a-z]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
      values.set(m[1].toLowerCase(), decodeEntities(m[2] ?? m[3] ?? ""))
    }
    const title = decodeEntities(caption.replace(/<[^>]*>/g, "")).trim()
    const svg = renderGraphSvg(graphSpecFrom(name => values.get(name)), title || "Graph")
    if (!svg) return ""
    return `<figure class="lesson-graph-figure">${svg}${caption.trim() ? `<figcaption>${caption.trim()}</figcaption>` : ""}</figure>`
  })
}
