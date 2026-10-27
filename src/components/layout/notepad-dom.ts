/**
 * DOM helpers for the live notepad (a contentEditable box):
 *  - ^ / _ start a superscript / subscript as you type
 *  - a matrix typed as [[1 2] [3 4]] (or over several lines) turns into a
 *    rendered matrix block the moment its last ] is typed
 *
 * Kept out of the React component because it all works on the live DOM
 * selection rather than React state.
 */
import { BRACKET_MATRIX, findScripts, mayHaveScripts, parseMatrixCells } from "@/components/ui/math-text"

/** Invisible character that gives the caret somewhere to sit (inside an empty <sup>, after a matrix) */
export const ZWSP = "​"
const MATRIX_AT_CARET = new RegExp(`(?:${BRACKET_MATRIX})$`)

export type ScriptKind = "sup" | "sub"

// ------------------------------------------------------------------ caret

export function caretRange(editor: HTMLElement): Range | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  return editor.contains(range.startContainer) ? range : null
}

export function placeCaret(node: Node, offset: number) {
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

export function placeCaretAtEnd(editor: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(editor)
  range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

// ------------------------------------------------------------ super/subscript

/** The <sup>/<sub> the caret is in, if any */
export function scriptAt(editor: HTMLElement, node: Node | null): HTMLElement | null {
  for (let n = node; n && n !== editor; n = n.parentNode) {
    if (n.nodeName === "SUP" || n.nodeName === "SUB") return n as HTMLElement
  }
  return null
}

export function startScript(editor: HTMLElement, kind: ScriptKind) {
  const range = caretRange(editor)
  if (!range) return
  range.deleteContents()
  const el = document.createElement(kind)
  el.textContent = ZWSP
  range.insertNode(el)
  placeCaret(el.firstChild!, 1)
}

/** Move the caret out of a <sup>/<sub>, optionally typing `after` (e.g. a space) */
export function exitScript(el: HTMLElement, after = ZWSP) {
  const text = document.createTextNode(after)
  el.after(text)
  placeCaret(text, text.length)
}

export function isScriptEmpty(el: HTMLElement) {
  return (el.textContent ?? "").replaceAll(ZWSP, "") === ""
}

export function caretAtEndOf(el: HTMLElement, range: Range) {
  const rest = document.createRange()
  rest.setStart(range.endContainer, range.endOffset)
  rest.setEnd(el, el.childNodes.length)
  return rest.toString().replaceAll(ZWSP, "") === ""
}

/** The ^ or _ just typed: remove it from the text, then start (or finish) a script */
export function handleScriptKey(editor: HTMLElement, ch: "^" | "_") {
  const range = caretRange(editor)
  if (!range) return
  const node = range.startContainer
  const offset = range.startOffset
  if (node.nodeType === Node.TEXT_NODE && offset > 0 && (node as Text).data[offset - 1] === ch) {
    ;(node as Text).deleteData(offset - 1, 1)
    placeCaret(node, offset - 1)
  }
  const current = scriptAt(editor, node)
  // Typing ^ again inside a superscript finishes it
  if (current) exitScript(current)
  else startScript(editor, ch === "^" ? "sup" : "sub")
}

// ------------------------------------------------------------------ matrices

export function readRows(el: HTMLElement): string[][] {
  try {
    const rows = JSON.parse(el.dataset.matrix ?? "[]")
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

export function matrixLiteral(rows: string[][]) {
  return `[${rows.map(r => `[${r.join(", ")}]`).join(", ")}]`
}

/** A matrix cell with its powers and subscripts raised/lowered */
function renderCell(cell: string): HTMLElement {
  const span = document.createElement("span")
  const scripts = mayHaveScripts(cell) ? findScripts(cell) : []
  let last = 0
  for (const s of scripts) {
    if (s.start > last) span.append(cell.slice(last, s.start))
    if (s.kind === "op") span.append(s.symbol)
    else {
      const el = document.createElement(s.kind)
      el.textContent = s.value
      span.append(el)
    }
    last = s.end
  }
  if (last < cell.length) span.append(cell.slice(last))
  return span
}

const PENCIL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>'

/** (Re)draw a matrix block from its rows */
export function renderMatrix(wrap: HTMLElement, rows: string[][]) {
  wrap.dataset.matrix = JSON.stringify(rows)
  wrap.contentEditable = "false"
  wrap.className = "relative mx-1 inline-block align-middle"

  const matrix = document.createElement("span")
  matrix.className = "tc-matrix"
  matrix.setAttribute("role", "math")
  matrix.setAttribute("aria-label", `Matrix ${rows.map(r => r.join(", ")).join("; ")}`)
  const grid = document.createElement("span")
  grid.className = "tc-matrix-grid"
  grid.style.gridTemplateColumns = `repeat(${rows[0]?.length ?? 1}, auto)`
  for (const row of rows) for (const cell of row) grid.append(renderCell(cell))
  matrix.append(grid)

  const edit = document.createElement("button")
  edit.type = "button"
  edit.dataset.matrixEdit = ""
  edit.title = "Edit matrix"
  edit.setAttribute("aria-label", "Edit matrix")
  edit.className =
    "absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-70 shadow transition-opacity hover:opacity-100 focus:opacity-100"
  edit.innerHTML = PENCIL_SVG

  wrap.replaceChildren(matrix, edit)
}

export function createMatrix(rows: string[][]) {
  const wrap = document.createElement("span")
  renderMatrix(wrap, rows)
  return wrap
}

// -------------------------------------------------------------- serialising

interface Serialized {
  text: string
  /** Where each "[" in `text` lives in the DOM */
  brackets: Map<number, { node: Node; offset: number }>
}

/**
 * The editor's contents as plain text, up to `stop` if given.
 * - "detect": powers as ^{…}, existing matrices as a separator (so a new
 *   matrix can't swallow one), and the DOM position of every "["
 * - "export": readable text for downloads and word counts (matrices as [[…]])
 */
export function serialize(
  root: HTMLElement,
  mode: "detect" | "export",
  stop?: { node: Node; offset: number }
): Serialized {
  let text = ""
  const brackets: Serialized["brackets"] = new Map()
  const newline = () => {
    if (text && !text.endsWith("\n")) text += "\n"
  }

  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const data = (node as Text).data
      const limit = stop && node === stop.node ? stop.offset : data.length
      for (let i = 0; i < limit; i++) {
        const ch = data[i]
        if (ch === ZWSP) continue
        if (ch === "[") brackets.set(text.length, { node, offset: i })
        text += ch
      }
      return !!stop && node === stop.node
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return false
    const el = node as HTMLElement
    if (el.dataset.matrix !== undefined) {
      text += mode === "export" ? matrixLiteral(readRows(el)) : "\u0001"
      return !!stop && el === stop.node
    }
    if (el.tagName === "BR") {
      text += "\n"
      return false
    }
    if (el !== root && /^(DIV|P)$/.test(el.tagName)) newline()

    const mark = el.tagName === "SUP" ? "^" : el.tagName === "SUB" ? "_" : null
    const at = text.length
    if (mark) text += `${mark}{`
    const children = [...el.childNodes]
    const limit = stop && el === stop.node ? stop.offset : children.length
    for (let i = 0; i < limit; i++) if (walk(children[i])) return true
    if (stop && el === stop.node) return true
    if (mark) {
      const inner = text.slice(at + 2)
      // x^2 rather than x^{2} in downloads
      if (mode === "export" && [...inner].length === 1) text = text.slice(0, at) + mark + inner
      else text += "}"
    }
    return false
  }

  walk(root)
  return { text, brackets }
}

const isBlock = (n: Node) => n.nodeName === "DIV" || n.nodeName === "P"

/** If the text just before the caret ends a matrix literal, replace it with a matrix block */
export function convertMatrixAtCaret(editor: HTMLElement): boolean {
  const range = caretRange(editor)
  if (!range || !range.collapsed) return false
  const { text, brackets } = serialize(editor, "detect", { node: range.endContainer, offset: range.endOffset })
  if (!text.endsWith("]")) return false
  const match = text.match(MATRIX_AT_CARET)
  if (!match || match.index === undefined) return false
  // Cells as typed: x^{2} from a superscript reads better as x^2 in the edit box
  const rows = parseMatrixCells(match[0])?.map(row => row.map(cell => cell.replace(/([\^_])\{([^{}])\}/g, "$1$2")))
  const start = brackets.get(match.index)
  const atLineStart = match.index === 0 || text[match.index - 1] === "\n"
  if (!rows || !start) return false

  const replace = document.createRange()
  replace.setStart(start.node, start.offset)
  replace.setEnd(range.endContainer, range.endOffset)
  replace.deleteContents()
  const block = createMatrix(rows)
  replace.insertNode(block)
  // Lines the matrix was typed over are now empty
  editor.querySelectorAll("div, p").forEach(d => {
    if (!d.textContent?.replaceAll(ZWSP, "") && !d.querySelector("br, [data-matrix]")) d.remove()
  })
  const after = document.createTextNode(ZWSP)
  block.after(after)
  // A matrix started on its own line stays on its own line (deleting the
  // typed rows can pull it up onto the line before)
  if (atLineStart) {
    let contentBefore = false
    for (let prev = block.previousSibling; prev && !isBlock(prev); prev = prev.previousSibling) {
      if (prev.nodeName === "BR") break
      if ((prev.textContent ?? "").replaceAll(ZWSP, "")) {
        contentBefore = true
        break
      }
    }
    if (contentBefore) {
      const line = document.createElement("div")
      block.before(line)
      for (let n: ChildNode | null = block; n && !isBlock(n); ) {
        const next: ChildNode | null = n.nextSibling
        line.append(n)
        n = next
      }
    }
  }
  placeCaret(after, 1)
  return true
}

// ---------------------------------------------------------------- storage

/** Notes are the user's own, but strip anything executable before using innerHTML */
export function sanitizeNotes(html: string): string {
  const tpl = document.createElement("template")
  tpl.innerHTML = html
  tpl.content.querySelectorAll("script, style, iframe, object, embed, link, meta").forEach(n => n.remove())
  tpl.content.querySelectorAll("*").forEach(el => {
    for (const attr of [...el.attributes]) {
      if (/^on/i.test(attr.name) || /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name)
    }
  })
  return tpl.innerHTML
}

/** Plain text (from the first version of the notepad) as editor HTML */
export function textToHtml(text: string): string {
  const div = document.createElement("div")
  return text
    .split("\n")
    .map(line => {
      div.textContent = line
      return `<div>${div.innerHTML || "<br>"}</div>`
    })
    .join("")
}

export function isEditorEmpty(editor: HTMLElement) {
  return !(editor.textContent ?? "").replaceAll(ZWSP, "").trim() && !editor.querySelector("[data-matrix]")
}
