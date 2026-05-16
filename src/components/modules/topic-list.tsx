'use client'

import Link from 'next/link'
import { BookOpen, CheckCircle2, HelpCircle, Layers, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopicItem {
    id: string
    title: string
    _count: { questions: number; flashcards: number }
    userAnswers: { id: string }[]
}

interface ChapterWithTopics {
    id: string
    title: string
    topics: TopicItem[]
}

interface TopicListProps {
    moduleId: string
    chapters: ChapterWithTopics[]
    /** Fraction of questions answered to consider a topic "complete". Default 0.7 */
    completionThreshold?: number
}

function getTopicStatus(topic: TopicItem, threshold: number) {
    const total = topic._count.questions
    const answered = topic.userAnswers.length
    if (total === 0) return 'no-questions'
    if (answered >= Math.floor(total * threshold)) return 'complete'
    if (answered > 0) return 'in-progress'
    return 'not-started'
}

function TopicRow({
    topic,
    moduleId,
    chapterId,
    threshold,
}: {
    topic: TopicItem
    moduleId: string
    chapterId: string
    threshold: number
}) {
    const status = getTopicStatus(topic, threshold)
    const hasQuestions = topic._count.questions > 0
    const hasFlashcards = topic._count.flashcards > 0
    const answered = topic.userAnswers.length
    const total = topic._count.questions

    return (
        <div className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
            {/* Status icon */}
            <div className="shrink-0">
                {status === 'complete' && (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                )}
                {status === 'in-progress' && (
                    <div className="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                )}
                {(status === 'not-started' || status === 'no-questions') && (
                    <div className="w-5 h-5 rounded-full border-2 border-border" />
                )}
            </div>

            {/* Title + meta */}
            <div className="flex-1 min-w-0">
                <p className={cn(
                    'text-sm font-medium truncate',
                    status === 'complete' && 'text-muted-foreground line-through',
                )}>
                    {topic.title}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                    {hasQuestions && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <HelpCircle className="w-3 h-3" />
                            {answered}/{total} answered
                        </span>
                    )}
                    {hasFlashcards && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Layers className="w-3 h-3" />
                            {topic._count.flashcards} cards
                        </span>
                    )}
                    {!hasQuestions && !hasFlashcards && (
                        <span className="text-xs text-muted-foreground">No content yet</span>
                    )}
                </div>
            </div>

            {/* Mini progress bar (when in-progress) */}
            {status === 'in-progress' && total > 0 && (
                <div className="hidden sm:block w-16 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
                    <div
                        className="h-full gradient-primary rounded-full transition-all"
                        style={{ width: `${Math.round((answered / total) * 100)}%` }}
                    />
                </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {hasFlashcards && (
                    <Link
                        href={`/modules/${moduleId}/chapters/${chapterId}/topics/${topic.id}/flashcards`}
                        className="px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 text-xs font-medium hover:bg-teal-500/20 transition-colors"
                        onClick={e => e.stopPropagation()}
                    >
                        Cards
                    </Link>
                )}
                {hasQuestions && (
                    <Link
                        href={`/modules/${moduleId}/chapters/${chapterId}/topics/${topic.id}/quiz`}
                        className="px-2.5 py-1 rounded-lg gradient-primary text-white text-xs font-medium"
                        onClick={e => e.stopPropagation()}
                    >
                        Quiz
                    </Link>
                )}
                {!hasQuestions && !hasFlashcards && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
            </div>
        </div>
    )
}

function ChapterSection({
    chapter,
    index,
    moduleId,
    threshold,
}: {
    chapter: ChapterWithTopics
    index: number
    moduleId: string
    threshold: number
}) {
    const total = chapter.topics.length
    const completed = chapter.topics.filter(
        t => getTopicStatus(t, threshold) === 'complete'
    ).length
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0

    return (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
            {/* Chapter header */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-muted/30">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{index + 1}</span>
                </div>

                <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-sm truncate">{chapter.title}</p>
                    <p className="text-xs text-muted-foreground">
                        {completed}/{total} topic{total !== 1 ? 's' : ''} done
                    </p>
                </div>

                {total > 0 && (
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full gradient-primary rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                        <span className="text-xs font-semibold w-8 text-right">{pct}%</span>
                    </div>
                )}
            </div>

            {/* Topic rows */}
            <div className="divide-y divide-border">
                {chapter.topics.length > 0 ? (
                    chapter.topics.map(topic => (
                        <TopicRow
                            key={topic.id}
                            topic={topic}
                            moduleId={moduleId}
                            chapterId={chapter.id}
                            threshold={threshold}
                        />
                    ))
                ) : (
                    <p className="px-4 py-3 text-sm text-muted-foreground">No topics yet.</p>
                )}
            </div>
        </div>
    )
}

export function TopicList({ moduleId, chapters, completionThreshold = 0.7 }: TopicListProps) {
    if (chapters.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground/20 mb-3" />
                <p className="text-muted-foreground">No chapters yet.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {chapters.map((chapter, i) => (
                <ChapterSection
                    key={chapter.id}
                    chapter={chapter}
                    index={i}
                    moduleId={moduleId}
                    threshold={completionThreshold}
                />
            ))}
        </div>
    )
}
