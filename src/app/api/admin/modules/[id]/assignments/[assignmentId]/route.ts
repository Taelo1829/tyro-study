import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { deleteUploadedAssignment } from "@/lib/delete-uploaded-assignment"
import { captureError } from "@/lib/monitoring"
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error
  const { id, assignmentId } = await params
  try {
    if (!await deleteUploadedAssignment(id, assignmentId)) return NextResponse.json({ error: "Uploaded assignment not found in this module." }, { status: 404 })
    return NextResponse.json({ deleted: true })
  } catch (err) {
    captureError("Delete uploaded assignment failed", err, "/api/admin/modules/[id]/assignments/[assignmentId]")
    return NextResponse.json({ error: "Could not delete this assignment. Nothing was changed. Please retry." }, { status: 500 })
  }
}
