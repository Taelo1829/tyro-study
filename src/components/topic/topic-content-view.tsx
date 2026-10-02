"use client"

import { useMemo, useSyncExternalStore } from "react"
import { renderTopicContent } from "@/lib/topic-content"
import { cn } from "@/lib/utils"

const subscribeNoop = () => () => {}

/**
 * Shows a topic's lesson (or assignment) the way it was written in the
 * editor: headings, lists, images, callouts, tables, videos and matrices —
 * cleaned up and styled as a readable article.
 */
export function TopicContentView({
  content,
  className,
  empty = "No content available for this topic yet.",
}: {
  content: string | null | undefined
  className?: string
  empty?: string
}) {
  // Sanitising needs the browser's DOM parser, so render after hydration
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false)
  const html = useMemo(() => (isClient ? renderTopicContent(content) : ""), [content, isClient])

  if (!isClient) return <div className={cn("topic-content topic-article", className)} />

  if (!html) {
    return <p className="text-muted-foreground italic">{empty}</p>
  }

  return (
    <div
      className={cn("topic-content topic-article", className)}
      // Sanitised by renderTopicContent (allowlist of tags/attributes)
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
