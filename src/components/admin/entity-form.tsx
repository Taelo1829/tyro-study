"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import NeumorphicEditor from "./rich-text-editor"

interface Field {
  name: string
  label: string
  /** text: one line · textarea: plain text · richtext: the lesson editor (saves HTML) */
  type?: "text" | "textarea" | "richtext"
  placeholder?: string
  required?: boolean
}

interface EntityFormProps {
  fields: Field[]
  submitLabel: string
  onSubmit: (values: Record<string, string>) => Promise<void>
  onCancel?: () => void
}

export function EntityForm({
  fields,
  submitLabel,
  onSubmit,
  onCancel,
}: EntityFormProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await onSubmit(values)
      setValues({})
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {fields.map((field) => (
        <div key={field.name}>
          <label className="mb-1.5 block text-sm font-medium">
            {field.label}
          </label>
          {field.type === "richtext" ? (
            <NeumorphicEditor
              value={values[field.name] ?? ""}
              setHtml={(e) => setValues((v) => ({ ...v, [field.name]: e }))}
            />
          ) : field.type === "textarea" ? (
            <textarea
              placeholder={field.placeholder}
              required={field.required}
              rows={3}
              value={values[field.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
              className="neo-inset w-full resize-y rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/50"
            />
          ) : (
            <Input
              placeholder={field.placeholder}
              required={field.required}
              value={values[field.name] ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [field.name]: e.target.value }))
              }
            />
          )}
        </div>
      ))}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
