"use client"
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronRight, PlayCircle } from 'lucide-react'
import NextLink from 'next/link'
import { Button } from '@/components/ui/button'
import { useParams, useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useState } from 'react'

interface ChapterDetail {
    title: string
    module: { id: string }
    topics: { id: string; title: string; _count: { questions: number } }[]
}
const ChapterPage = () => {
    const [chapter, setChapter] = useState<ChapterDetail | null>(null)
    const [loading, setLoading] = useState(false)
    const params = useParams()
    const router = useRouter()
    const id = params.chapterId
    const load = useCallback(async () => {
        setLoading(true)
        const res = await fetch(`/api/chapters/${id}`)
        if (res.ok) setChapter(await res.json())
        setLoading(false)
    }, [id])

    useEffect(() => {
        load()
    }, [load])

    if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>
    return (
        <>
            <Header
                title={chapter?.title}
                subtitle="Topics in this Chapter" />
            <div
                onClick={() => router.back()}
                className="mb-6 inline-block text-sm text-muted-foreground hover:text-primary"
            >
                ← All Chapters
            </div>

            {chapter && chapter.topics.some((topic) => topic._count.questions > 0) && (
                <Card className="mb-6 border-primary/30 bg-primary/5">
                    <CardContent className="flex items-center justify-between py-4">
                        <div><p className="font-semibold">Chapter quiz</p><p className="text-sm text-muted-foreground">Test everything in this chapter.</p></div>
                        <NextLink href={`/modules/${chapter.module.id}/chapters/${id}/quiz`}><Button><PlayCircle /> Start quiz</Button></NextLink>
                    </CardContent>
                </Card>
            )}
            {chapter?.topics.map((tp) => (
                <div key={tp.id} className='my-3'>
                    <Card>
                        <CardContent onClick={() => router.push(`/modules/${id}/topics/${tp.id}`)} className="flex items-center justify-between py-4">
                            <div>
                                <p className="font-semibold">{tp.title}</p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </CardContent>
                    </Card>
                </div>
            ))}
        </>
    )
}

export default ChapterPage
