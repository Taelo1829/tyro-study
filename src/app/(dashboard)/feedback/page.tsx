import type { Metadata } from "next"
import { FeedbackForm } from "@/components/feedback/feedback-form"

export const metadata: Metadata = { title: "Send feedback" }

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ from?: string; kind?: string }> }) {
  const { from, kind } = await searchParams
  return <FeedbackForm from={from?.startsWith("/") ? from : undefined} initialKind={kind} />
}
