"use client"

import { Fragment } from "react"
import { splitAtBlanks } from "@/lib/code-blanks"
import { cn } from "@/lib/utils"

/**
 * Code shown as written, with a text box at each blank (____) to type into.
 * Used by "Try it yourself" exercises and type-the-answer quiz questions.
 */

export type BlankState = "idle" | "right" | "wrong"

export function CodeWithBlanks({
  code,
  values,
  onChange,
  states,
  disabled,
  onEnter,
  label = "Blank",
  className,
}: {
  code: string
  values: string[]
  onChange: (index: number, value: string) => void
  states?: BlankState[]
  disabled?: boolean
  /** Enter in a box (e.g. to check the answer) */
  onEnter?: () => void
  label?: string
  className?: string
}) {
  const parts = splitAtBlanks(code)
  const blanks = parts.length - 1
  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-2xl border border-border bg-[#f6f7f9] p-4 font-mono text-[0.9rem] leading-[2.1] text-foreground",
        className
      )}
    >
      <code>
        {parts.map((text, i) => (
          <Fragment key={i}>
            {text}
            {i < blanks && (
              <input
                type="text"
                value={values[i] ?? ""}
                onChange={e => onChange(i, e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && onEnter) {
                    e.preventDefault()
                    onEnter()
                  }
                }}
                disabled={disabled}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                aria-label={blanks > 1 ? `${label} ${i + 1}` : label}
                // Grows with what's typed (at least 6 characters wide)
                style={{ width: `${Math.max(6, (values[i]?.length ?? 0) + 2)}ch` }}
                className={cn(
                  "mx-0.5 rounded-md border-2 bg-white px-1.5 py-0.5 font-mono text-[0.9rem] leading-normal outline-none transition-colors",
                  "focus:border-foreground disabled:opacity-100",
                  states?.[i] === "right" && "border-green-600 bg-green-50 text-green-900",
                  states?.[i] === "wrong" && "border-red-500 bg-red-50 text-red-900",
                  (!states?.[i] || states[i] === "idle") && "border-dashed border-muted-foreground/60"
                )}
              />
            )}
          </Fragment>
        ))}
      </code>
    </pre>
  )
}
