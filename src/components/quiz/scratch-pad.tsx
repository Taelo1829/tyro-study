"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Eraser, NotebookPen, Pencil, Trash2, Type, Undo2, X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Floating scratch paper for quizzes.
 *  - "Type" tab: plain notes
 *  - "Draw" tab: freehand pencil (mouse, finger or stylus) with eraser, undo, clear
 *
 * It sits beside the question (not a blocking pop-up) so you can work while
 * reading. Notes and drawings stay while you move between questions and are
 * wiped when the component is remounted (the quiz screen does that for each
 * new attempt). Nothing is saved to the server.
 */

type Tool = "pen" | "eraser"
type Point = [number, number]
interface Stroke {
  tool: Tool
  color: string
  size: number
  points: Point[]
}

const COLORS = ["#16181d", "#1d8fd8", "#e5484d", "#16a34a"]
const SIZES = [2, 4, 8]

export function ScratchPad() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"type" | "draw">("type")
  const [text, setText] = useState("")
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [tool, setTool] = useState<Tool>("pen")
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(SIZES[0])

  const hasContent = text.trim().length > 0 || strokes.length > 0

  return (
    <>
      {/* Floating button (sits above the mobile bottom bar) */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={open ? "Close notepad" : "Open notepad"}
        title="Notepad / scratch paper"
        className={cn(
          "fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-xl shadow-black/20 transition-transform active:scale-95 lg:bottom-8 lg:right-8",
          open ? "bg-card text-foreground ring-1 ring-border" : "bg-primary text-primary-foreground"
        )}
      >
        {open ? <X className="h-6 w-6" /> : <NotebookPen className="h-6 w-6" />}
        {!open && hasContent && (
          <span className="absolute right-1 top-1 h-3 w-3 rounded-full border-2 border-primary bg-orange" aria-hidden="true" />
        )}
      </button>

      {open && (
        <section
          aria-label="Notepad"
          className="fixed inset-x-3 bottom-40 z-40 flex h-[min(55dvh,460px)] flex-col overflow-hidden rounded-[var(--neo-radius-lg)] bg-card shadow-2xl shadow-black/20 ring-1 ring-border lg:inset-x-auto lg:bottom-28 lg:right-8 lg:h-[560px] lg:w-[440px]"
        >
          {/* Header: tabs + close */}
          <div className="flex items-center gap-2 border-b border-border p-2">
            <div className="flex flex-1 rounded-full bg-muted p-1" role="tablist" aria-label="Notepad mode">
              {([
                ["type", "Type", Type],
                ["draw", "Draw", Pencil],
              ] as const).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => setMode(value)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                    mode === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close notepad"
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {mode === "type" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Jot down working, notes or ideas…"
                aria-label="Notes"
                className="min-h-0 flex-1 resize-none bg-[repeating-linear-gradient(transparent,transparent_31px,var(--neo-border)_31px,var(--neo-border)_32px)] bg-local px-4 pt-[6px] text-base leading-8 text-foreground outline-none placeholder:text-muted-foreground"
                autoFocus
              />
              <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
                <span>{text.trim() ? `${text.trim().split(/\s+/).length} words` : "Notes stay while you move between questions"}</span>
                {text && (
                  <button type="button" onClick={() => setText("")} className="flex items-center gap-1 rounded-full px-2 py-1 hover:bg-muted hover:text-foreground">
                    <Trash2 className="h-3.5 w-3.5" /> Clear
                  </button>
                )}
              </div>
            </div>
          ) : (
            <DrawingArea
              strokes={strokes}
              setStrokes={setStrokes}
              tool={tool}
              setTool={setTool}
              color={color}
              setColor={setColor}
              size={size}
              setSize={setSize}
            />
          )}
        </section>
      )}
    </>
  )
}

function DrawingArea({
  strokes,
  setStrokes,
  tool,
  setTool,
  color,
  setColor,
  size,
  setSize,
}: {
  strokes: Stroke[]
  setStrokes: React.Dispatch<React.SetStateAction<Stroke[]>>
  tool: Tool
  setTool: (t: Tool) => void
  color: string
  setColor: (c: string) => void
  size: number
  setSize: (s: number) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const current = useRef<Stroke | null>(null)

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, s: Stroke) => {
    if (s.points.length === 0) return
    ctx.save()
    ctx.globalCompositeOperation = s.tool === "eraser" ? "destination-out" : "source-over"
    ctx.strokeStyle = s.color
    ctx.fillStyle = s.color
    ctx.lineWidth = s.tool === "eraser" ? s.size * 4 : s.size
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    if (s.points.length === 1) {
      const [x, y] = s.points[0]
      ctx.beginPath()
      ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.moveTo(s.points[0][0], s.points[0][1])
      // Smooth the line through midpoints
      for (let i = 1; i < s.points.length - 1; i++) {
        const [x, y] = s.points[i]
        const [nx, ny] = s.points[i + 1]
        ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2)
      }
      const last = s.points[s.points.length - 1]
      ctx.lineTo(last[0], last[1])
      ctx.stroke()
    }
    ctx.restore()
  }, [])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const s of strokes) drawStroke(ctx, s)
    if (current.current) drawStroke(ctx, current.current)
  }, [strokes, drawStroke])

  // Keep the canvas sharp and the right size (redraw strokes after resizing)
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const { width, height } = wrap.getBoundingClientRect()
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      redraw()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [redraw])

  function point(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect()
    return [e.clientX - rect.left, e.clientY - rect.top]
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    current.current = { tool, color, size, points: [point(e)] }
    redraw()
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!current.current) return
    // Use coalesced events for smoother lines on fast strokes
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
    const rect = e.currentTarget.getBoundingClientRect()
    for (const ev of events) current.current.points.push([ev.clientX - rect.left, ev.clientY - rect.top])
    redraw()
  }

  function onPointerUp() {
    if (!current.current) return
    const finished = current.current
    current.current = null
    setStrokes(prev => [...prev, finished])
  }

  const toolButton = (active: boolean) =>
    cn(
      "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
    )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar: tools, thickness and undo/clear on top; colours underneath */}
      <div className="space-y-1 border-b border-border px-2 py-1.5">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setTool("pen")} aria-pressed={tool === "pen"} aria-label="Pencil" title="Pencil" className={toolButton(tool === "pen")}>
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setTool("eraser")} aria-pressed={tool === "eraser"} aria-label="Eraser" title="Eraser" className={toolButton(tool === "eraser")}>
            <Eraser className="h-4 w-4" />
          </button>

          <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />

          {SIZES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSize(s)}
              aria-label={`Line thickness ${s}`}
              aria-pressed={size === s}
              className={toolButton(size === s)}
            >
              <span className="rounded-full bg-current" style={{ width: s + 3, height: s + 3 }} />
            </button>
          ))}

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setStrokes(prev => prev.slice(0, -1))}
              disabled={strokes.length === 0}
              aria-label="Undo"
              title="Undo"
              className={cn(toolButton(false), "disabled:opacity-40")}
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => strokes.length > 0 && confirm("Clear your drawing?") && setStrokes([])}
              disabled={strokes.length === 0}
              aria-label="Clear drawing"
              title="Clear drawing"
              className={cn(toolButton(false), "hover:text-red-600 disabled:opacity-40")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 pl-0.5">
          {COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => { setColor(c); setTool("pen") }}
              aria-label={`Colour ${c}`}
              aria-pressed={color === c && tool === "pen"}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full",
                color === c && tool === "pen" ? "ring-2 ring-accent ring-offset-1 ring-offset-card" : ""
              )}
            >
              <span className="h-5 w-5 rounded-full" style={{ background: c }} />
            </button>
          ))}
        </div>
      </div>

      {/* Canvas on dotted paper */}
      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1 bg-[radial-gradient(var(--neo-border)_1px,transparent_1px)] [background-size:20px_20px]"
      >
        <canvas
          ref={canvasRef}
          aria-label="Drawing area"
          className={cn("absolute inset-0 touch-none", tool === "eraser" ? "cursor-cell" : "cursor-crosshair")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={e => { if (e.buttons === 0) onPointerUp() }}
        />
        {strokes.length === 0 && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Draw here with your finger, stylus or mouse
          </p>
        )}
      </div>
    </div>
  )
}
