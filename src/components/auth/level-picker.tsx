"use client"

import { GraduationCap, School } from "lucide-react"
import { STUDY_LEVELS, type StudyLevel } from "@/lib/levels"
import { cn } from "@/lib/utils"

/** "High school" or "University or college": two cards to pick from */
export function LevelPicker({
  value,
  onChange,
  disabled,
  name = "level",
}: {
  value: StudyLevel | null
  onChange: (level: StudyLevel) => void
  disabled?: boolean
  name?: string
}) {
  return (
    <div role="radiogroup" aria-label="Study level" className="grid gap-2 sm:grid-cols-2">
      {STUDY_LEVELS.map(l => {
        const Icon = l.id === "highschool" ? School : GraduationCap
        const selected = value === l.id
        return (
          <label
            key={l.id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3 transition-colors",
              selected ? "border-foreground bg-muted/50" : "border-border hover:bg-muted/40",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            <input
              type="radio"
              name={name}
              value={l.id}
              checked={selected}
              onChange={() => onChange(l.id)}
              disabled={disabled}
              className="sr-only"
            />
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              <span className="block text-sm font-semibold">{l.label}</span>
              <span className="block text-xs text-muted-foreground">{l.hint}</span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
