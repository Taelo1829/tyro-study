import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-session"
import { parseOnboardingInput } from "@/lib/onboarding-input"
import { OnboardingError, saveOnboardingStep } from "@/lib/onboarding"
import { captureError } from "@/lib/monitoring"

export async function POST(request: Request) {
  const { error, userId } = await requireAuth()
  if (error) return error
  let input
  try {
    input = parseOnboardingInput(await request.json())
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid setup choices." }, { status: 400 })
  }
  try {
    return NextResponse.json({ step: await saveOnboardingStep(userId!, input) })
  } catch (err) {
    if (err instanceof OnboardingError) return NextResponse.json({ error: err.message }, { status: 400 })
    captureError("Onboarding save failed", err, "/api/onboarding")
    return NextResponse.json({ error: "Couldn't save this step. Please try again." }, { status: 500 })
  }
}
