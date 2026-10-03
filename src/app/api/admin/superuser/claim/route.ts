import { NextResponse } from "next/server"

/**
 * Claiming superuser has been switched off (the first superuser is set up).
 * Superusers now grant superuser to other admins on Admin → Users.
 * This file is safe to delete, together with its folder.
 */
export async function POST() {
  return NextResponse.json({ error: "Claiming superuser is switched off" }, { status: 410 })
}
