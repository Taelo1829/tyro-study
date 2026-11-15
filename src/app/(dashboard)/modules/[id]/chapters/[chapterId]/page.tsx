"use client"
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { useCourseCrumb } from '@/components/modules/use-course-crumb'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, ChevronRight, Lock, PlayCircle } from 'lucide-react'
import NextLink from 'next/link'
import { Button } from '@/components/ui/button'
import { useParams, useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useState } from 'react'
import { ChapterProgressBar, formatDuration, type ModuleProgressData } from '@/components/progress/progress-report'

interface ChapterDetail {
    title: string
    module: { id: string; title: string }
    topics: { id: string; title: string; lockedBy?: { id: string; title: string } | null; _count: { questions: number } }[]
}
const isAssignmentQuiz = (topic: { title: string }) => topic.title.startsWith("Assignment quiz: ")
function DoneBadge() {
    return <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" title="You have passed this topic’s quiz">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />Done
    </span>
}

const ChapterPage = () => {
    const [chapter, setChapter] = useState<ChapterDetail | null>(null)
    const [loading, setLoading] = useState(false)
    // The chapter quiz's estimated time and this student's results on it
    const [chapterProgress, setChapterProgress] = useState<ModuleProgressData["chapters"][number] | null>(null)
    const [quizInfo, setQuizInfo] = useState<{ quizSize: number; estimateSeconds: number; best: number | null; attempts: number; failed: number; averageSeconds: number | null } | null>(null)
    const params = useParams()
    const router = useRouter()
    const id = params.chapterId
    const courseCrumb = useCourseCrumb(params.id as string)
    const load = useCallback(async () => {
        setLoading(true)
        const res = await fetch(`/api/chapters/${id}`)
        if (res.ok) setChapter(await res.json())
        setLoading(false)
        const prog = await fetch(`/api/progress/module/${params.id}`).catch(() => null)
        if (prog?.ok) {
            const data = await prog.json()
            const ch = data.chapters?.find((c: { id: string }) => c.id === id)
            if (ch) {
                setQuizInfo({ quizSize: ch.quizSize, estimateSeconds: ch.estimateSeconds, ...ch.stats })
                setChapterProgress(ch)
            }
        }
    }, [id, params.id])

    useEffect(() => {
        queueMicrotask(load)
    }, [load])

    const lessons = chapter?.topics.filter(topic => !isAssignmentQuiz(topic)) ?? []
    const assignments = chapter?.topics.filter(isAssignmentQuiz) ?? []
    const completedTopicIds = new Set(chapterProgress?.id === id ? chapterProgress.topics.filter(topic => topic.stats.passed > 0).map(topic => topic.id) : [])

    if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>
    return (
        <>
            {chapter && (
                <Breadcrumbs
                    items={[
                        ...courseCrumb,
                        { label: chapter.module.title, href: `/modules/${chapter.module.id}` },
                        { label: chapter.title },
                    ]}
                />
            )}

            {chapterProgress && (
                <section className="mb-6 rounded-[1.5rem] border border-border bg-white px-5 py-4">
                    <p className="mb-2 text-sm font-semibold">Your progress in this chapter</p>
                    <ChapterProgressBar chapter={chapterProgress} />
                    <p className="mt-2 text-xs text-muted-foreground">A topic is marked Done once you pass its quiz.</p>
                </section>
            )}

            {chapter && quizInfo && quizInfo.quizSize > 0 && (
                <Card className="mb-6 border-primary/30 bg-primary/5">
                    <CardContent className="flex items-center justify-between py-4">
                        <div>
                            <p className="font-semibold">Chapter quiz</p>
                            <p className="text-sm text-muted-foreground">
                                {quizInfo
                                    ? `${quizInfo.quizSize} questions · estimated ${formatDuration(quizInfo.estimateSeconds)}`
                                    : "Test everything in this chapter."}
                            </p>
                            {quizInfo && quizInfo.attempts > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Best {quizInfo.best}% · {quizInfo.attempts} {quizInfo.attempts === 1 ? "try" : "tries"} · {quizInfo.failed} failed · avg {formatDuration(quizInfo.averageSeconds)}
                                </p>
                            )}
                        </div>
                        <NextLink href={`/modules/${chapter.module.id}/chapters/${id}/quiz`}><Button><PlayCircle /> Start quiz</Button></NextLink>
                    </CardContent>
                </Card>
            )}
            {chapter && [...lessons, ...assignments].map((tp, index) => (
                <React.Fragment key={tp.id}>
                {assignments.length > 0 && index === lessons.length && <div className="mb-3 mt-8 border-t pt-6">
                    <h2 className="text-lg font-semibold">After studying: assignment quizzes</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Study this chapter and the earlier related chapters, then complete the assignment.</p>
                </div>}
                <div key={tp.id} className='my-3'>
                    <Card className={isAssignmentQuiz(tp) ? "border-foreground bg-muted/40" : undefined}>
                        {tp.lockedBy ? (
                            // Locked until the previous topic's quiz is passed
                            <CardContent className="flex cursor-not-allowed items-center justify-between gap-3 py-4 opacity-55 grayscale" aria-disabled="true" title="Locked">
                                <div className="min-w-0">
                                    <p className="flex items-center gap-2 font-semibold text-muted-foreground">
                                        <Lock className="h-4 w-4 shrink-0" />
                                        {isAssignmentQuiz(tp) ? tp.title.slice("Assignment quiz: ".length) : tp.title}
                                    </p>
                                    {completedTopicIds.has(tp.id) && <DoneBadge />}
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        Pass the{" "}
                                        <NextLink href={`/modules/${chapter.module.id}/topics/${tp.lockedBy.id}`} className="font-medium text-foreground underline underline-offset-2">
                                            {tp.lockedBy.title}
                                        </NextLink>{" "}
                                        quiz to unlock
                                    </p>
                                </div>
                                <Lock className="h-5 w-5 shrink-0 text-muted-foreground" />
                            </CardContent>
                        ) : (
                            <CardContent onClick={() => router.push(`/modules/${chapter.module.id}/topics/${tp.id}`)} className="flex cursor-pointer items-center justify-between py-4">
                                <div>
                                    <p className="font-semibold">{isAssignmentQuiz(tp) ? tp.title.slice("Assignment quiz: ".length) : tp.title}</p>
                                    {completedTopicIds.has(tp.id) && <DoneBadge />}
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </CardContent>
                        )}
                    </Card>
                </div>
                </React.Fragment>
            ))}
        </>
    )
}

export default ChapterPage
