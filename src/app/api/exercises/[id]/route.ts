import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { deleteExercise } from "@/lib/exercises"

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error
  if (!(await deleteExercise((await params).id))) return NextResponse.json({ error: "Exercise not found" }, { status: 404 })
  return NextResponse.json({ success: true })
}
