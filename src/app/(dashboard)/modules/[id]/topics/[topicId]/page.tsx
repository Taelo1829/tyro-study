"use client"

import { useState, useEffect, useRef } from "react"
import { redirect, useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
    BookOpen,
    Clock,
    Trophy,
    CheckCircle,
    AlertCircle,
    Loader2,
    ArrowLeft,
    PlayCircle,
    FileQuestion,
    Sparkles
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import FlashcardDeck from "@/components/modules/flash-card-decks"
import { Modal } from "@/components/admin/modal"
import { Input } from "@/components/ui/input"
import { loadYouTubeApi } from "@/app/helper"
import { YouTubeApi } from "@/app/types"

interface Topic {
    id: string
    title: string
    content: string
    order: number
    createdAt: string
    chapter: {
        id: string
        title: string
        module: {
            id: string
            title: string
        }
    }
    questions: Array<{
        id: string
        question: string
        difficulty: string
        answers: Array<{
            id: string
            answer: string
            isCorrect: boolean
        }>
    }>
    flashcards: Array<{
        id: string
        front: string
        back: string
    }>
    assignment?: string
    nextTopic?: string
}

interface UserProgress {
    completed: boolean
    quizAttempts: number
    bestScore: number
    lastAttemptAt: string | null
}

declare global {
    interface Window {
        YT?: YouTubeApi
        onYouTubeIframeAPIReady?: () => void
    }
}

export default function TopicPage() {
    const params = useParams()
    const router = useRouter()
    const { data: session } = useSession()
    const contentRef = useRef<HTMLDivElement>(null)
    const [topic, setTopic] = useState<Topic | null>(null)
    const [progress, setProgress] = useState<UserProgress | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isStartingQuiz, setIsStartingQuiz] = useState(false)
    const [activeTab, setActiveTab] = useState("content")
    const [isOpen, setIsOpen] = useState(false)
    const [assignmentIsOpen, setAssignmentIsOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [code, setCode] = useState<string | null>(null)
    const [result, setResult] = useState<any | null>(null)
    const [assignmentSubmissionLoading, setAssignmentSubmissionLoading] = useState(false)
    const topicId = params.topicId as string

    // Fetch topic data
    useEffect(() => {
        const fetchTopic = async () => {
            try {
                const response = await fetch(`/api/topics/${topicId}`)
                if (!response.ok) throw new Error("Failed to fetch topic")
                const data = await response.json()
                setTopic(data)
            } catch (error) {
                console.error("Error fetching topic:", error)
                toast.error("Error", "Failed to load topic content")
            } finally {
                setIsLoading(false)
            }
        }

        const fetchProgress = async () => {
            try {
                const response = await fetch(`/api/progress/topic/${topicId}`)
                if (response.ok) {
                    const data = await response.json()
                    setProgress(data)
                }
            } catch (error) {
                console.error("Error fetching progress:", error)
            }
        }

        if (topicId) {
            fetchTopic()
            fetchProgress()
        }
    }, [topicId])

    useEffect(() => {
        if (!topic?.content || activeTab !== "content" || !contentRef.current) {
            return
        }
        const cleanup = bindVideoProgress(contentRef.current, topic.id)
        return cleanup
    }, [activeTab, topic?.content, topic?.id])

    const handleStartQuiz = async () => {
        if (!topic?.questions?.length) {
            toast.warning("No Questions", "This topic doesn't have any questions yet.")
            return
        }

        setIsStartingQuiz(true)
        try {
            // Create a quiz attempt
            const response = await fetch("/api/quiz/attempt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    topicId: topic.id,
                    questionIds: topic.questions.map(q => q.id),
                }),
            })

            if (!response.ok) throw new Error("Failed to start quiz")

            await response.json()
            // Navigate to quiz page
            router.push(`/modules/${topic.chapter.module.id}/topics/${topic.id}/quiz`)
        } catch (error) {
            console.error("Error starting quiz:", error)
            toast.error("Error", "Failed to start quiz. Please try again.")
        } finally {
            setIsStartingQuiz(false)
        }
    }

    if (isLoading) {
        return <div>Loading...</div>
    }

    if (!topic) {
        return (
            <div className="container max-w-4xl mx-auto py-12 px-4">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Topic not found. Please check the URL or go back to the modules page.
                    </AlertDescription>
                </Alert>
                <div className="mt-4">
                    <Link href="/modules">
                        <Button variant="default">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Modules
                        </Button>
                    </Link>
                </div>
            </div>
        )
    }

    const hasQuestions = topic.questions?.length > 0
    const hasFlashcards = topic.flashcards?.length > 0

    const toggle = () => {
        setIsOpen(!isOpen)
    }

    const toggleAssignment = () => {
        setAssignmentIsOpen(!assignmentIsOpen)
    }

    async function loadFile(f: File) {
        // Accept .cpp, .c, .h, .hpp, .txt, or plain text
        const allowed = ['.cpp', '.c', '.h', '.hpp', '.cc', '.cxx', '.txt']
        const ext = '.' + f.name.split('.').pop()?.toLowerCase()
        if (!allowed.includes(ext)) {
            alert(`Unsupported file type "${ext}". Please upload a C/C++ source file.`)
            return
        }
        const text = await f.text()
        setFile(f)
        setCode(text)
        setResult(null)
    }

    function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0]
        if (f) loadFile(f)
        e.target.value = ''
    }

    async function handleSubmit() {
        if (!code?.trim()) return
        // setLoading(true)
        // setError(null)

        try {
            setAssignmentSubmissionLoading(true)
            const res = await fetch('/api/assignment/grade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topicId, code, filename: file?.name ?? 'submission.cpp' }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error ?? `Server error ${res.status}`)
            }

            const data = await res.json()
            setResult(data)
            setIsOpen(false)
            setAssignmentIsOpen(true)
            setAssignmentSubmissionLoading(false)
            setFile(null)
        } catch (err: any) {
            //   setError(err.message ?? 'Something went wrong. Please try again.')
        } finally {
            //   setLoading(false)
        }
    }

    async function navigateToNextTopic() {
        router.push(`/modules/${topic?.chapter.module.id}/topics/${topic?.nextTopic}`)
    }

    console.log(topic)
    return (
        <div>
            <Header title={topic.title} subtitle="" />
            <div>
                <div className="container max-w-4xl mx-auto px-4 ">
                    <div className="mb-4">
                        <Link
                            href={`/modules/${topic.chapter.module.id}`}
                            className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center"
                        >
                            <ArrowLeft className="mr-1 h-4 w-4" />
                            Back to {topic.chapter.module.title}
                        </Link>
                    </div>
                </div>
            </div>

            <div className="container max-w-4xl mx-auto px-4 ">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="grid w-full grid-cols-2 lg:grid-cols-3">
                        <TabsTrigger value="content" className="space-x-2">
                            <BookOpen className="h-4 w-4" />
                            <span>Study Content</span>
                        </TabsTrigger>
                        {hasFlashcards && (
                            <TabsTrigger value="flashcards" className="space-x-2">
                                <Sparkles className="h-4 w-4" />
                                <span>Flashcards</span>
                            </TabsTrigger>
                        )}
                        {topic?.questions?.length > 0 && <TabsTrigger value="quiz-prep" className="space-x-2">
                            <PlayCircle className="h-4 w-4" />
                            <span>Quiz Preparation</span>
                        </TabsTrigger>}
                    </TabsList>

                    <TabsContent value="content" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Study Material</CardTitle>
                                <CardDescription>
                                    Read through the content carefully. Take notes and make sure you understand the key concepts.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="prose prose-slate dark:prose-invert max-w-none">
                                    {topic.content ? (
                                        <div
                                            ref={contentRef}
                                            dangerouslySetInnerHTML={{ __html: formatContent(topic.content) }}
                                        />
                                    ) : (
                                        <p className="text-muted-foreground italic">
                                            No content available for this topic yet.
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {hasQuestions && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Key Takeaways</CardTitle>
                                    <CardDescription>
                                        Here&apos;s what you should know before taking the quiz.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2">
                                        {topic.questions.slice(0, 5).map((question) => (
                                            <li key={question.id} className="flex items-start gap-2">
                                                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                                                <span className="text-sm">{extractKeyPoint(question.question)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Flashcards Tab */}
                    {hasFlashcards && (
                        <TabsContent value="flashcards" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Study Flashcards</CardTitle>
                                    <CardDescription>
                                        Review these flashcards to reinforce your learning.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <FlashcardDeck flashcards={topic.flashcards} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )}

                    {/* Quiz Preparation Tab */}
                    <TabsContent value="quiz-prep" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Ready to Test Your Knowledge?</CardTitle>
                                <CardDescription>
                                    {hasQuestions
                                        ? `This quiz contains ${topic.questions.length} questions covering all the key concepts.`
                                        : "No questions available for this topic yet."}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {hasQuestions && (
                                    <>
                                        <div className="bg-muted/50 rounded-lg p-4">
                                            <h3 className="font-semibold mb-2">Quiz Information:</h3>
                                            <ul className="space-y-2 text-sm">
                                                <li className="flex items-center gap-2">
                                                    <FileQuestion className="h-4 w-4 text-primary" />
                                                    <span>{topic.questions.length} multiple-choice questions</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-primary" />
                                                    <span>No time limit - take your time to answer</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    <Trophy className="h-4 w-4 text-primary" />
                                                    <span>Passing score: 70%</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    <CheckCircle className="h-4 w-4 text-primary" />
                                                    <span>Instant feedback on your answers</span>
                                                </li>
                                            </ul>
                                        </div>

                                        {progress?.quizAttempts && progress?.quizAttempts > 0 && (
                                            <Alert>
                                                <Trophy className="h-4 w-4" />
                                                <AlertDescription>
                                                    You&apos;ve attempted this quiz {progress.quizAttempts} time(s).
                                                    Your best score was {progress.bestScore}%.
                                                    {progress.bestScore < 70
                                                        ? " Keep practicing to improve your score!"
                                                        : " Great job! Can you beat your best score?"}
                                                </AlertDescription>
                                            </Alert>
                                        )}

                                        <div className="flex flex-col sm:flex-row gap-4 pt-4">
                                            <Button
                                                onClick={handleStartQuiz}
                                                disabled={isStartingQuiz}
                                                size="lg"
                                                className="flex-1"
                                            >
                                                {isStartingQuiz ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Starting Quiz...
                                                    </>
                                                ) : (
                                                    <>
                                                        <PlayCircle className="mr-2 h-4 w-4" />
                                                        Attempt Quiz Now
                                                    </>
                                                )}
                                            </Button>

                                            {hasFlashcards && (
                                                <Button
                                                    variant="default"
                                                    size="lg"
                                                    onClick={() => setActiveTab("flashcards")}
                                                    className="flex-1"
                                                >
                                                    <Sparkles className="mr-2 h-4 w-4" />
                                                    Review Flashcards First
                                                </Button>
                                            )}
                                        </div>
                                    </>
                                )}

                                {!hasQuestions && (
                                    <div className="text-center py-8">
                                        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                        <p className="text-muted-foreground">
                                            No questions have been added to this topic yet.
                                        </p>
                                        {session?.user?.email === "admin@tyrostudy.com" && (
                                            <Button
                                                variant="default"
                                                className="mt-4"
                                                onClick={() => router.push(`/admin/topics/${topic.id}/questions`)}
                                            >
                                                Add Questions
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
                {topic.assignment && <Button className="float-end" onClick={toggle}>Attempt Assignment</Button>}
                <Modal open={isOpen} onClose={toggle} size="lg">
                    <Card className="h-full">
                        <div className="text-2xl pb-5">Assignment</div>
                        {assignmentSubmissionLoading ? <div>
                            <div>PLEASE WAIT WHILE WE PROCESS YOUR SUBMISSION...</div>
                        </div> : <div>
                            <div dangerouslySetInnerHTML={{ __html: topic.assignment || "" }}></div>
                            <div className="py-4">
                                <div>Add C++ Submission (Please only upload .cpp files e.g main.cpp)</div>
                                {!file ? <Input type="file" onChange={onFileChange} /> : <div>{file.name}</div>}
                            </div>
                            <div>
                                <Button className="float-end" onClick={() => {
                                    setFile(null)
                                    toggle()
                                }}>Close</Button>
                                <Button onClick={handleSubmit}>Submit</Button>
                            </div>
                        </div>}
                    </Card>
                </Modal>
            </div>
            <Modal open={assignmentIsOpen} onClose={toggleAssignment} size="md" >
                <Card className="p-4">
                    <div className="text-3xl">You have {result?.passed ? "passed" : "failed"} the assignment.</div>
                    <div className="text-2xl py-2">Score: {result?.percentage}%</div>
                    <div>{result?.summary}</div>
                    <div className="text-xl pt-4">YOU SHOULD WORK ON </div>
                    <div className="px-4 pt-1">
                        {result?.suggestions?.map((item: string, index: number) => {
                            return <li key={index}>
                                <div>{item}</div>
                            </li>
                        })}
                    </div>
                    <div className="py-4">
                        <Button className="float-end" onClick={toggleAssignment}>Close</Button>
                        {result?.passed && <Button className="float-end" onClick={navigateToNextTopic}>Next Topic</Button>}
                    </div>
                </Card>
            </Modal>
        </div>
    )
}

// Helper Functions


function getProgressKey(topicId: string, videoId: string) {
    return `topic-video-progress:${topicId}:${videoId}`
}

function getSavedSeconds(topicId: string, videoId: string) {
    const value = window.localStorage.getItem(getProgressKey(topicId, videoId))
    const seconds = value ? Number(value) : 0
    return Number.isFinite(seconds) ? seconds : 0
}

function saveSeconds(topicId: string, videoId: string, seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 1) return
    window.localStorage.setItem(getProgressKey(topicId, videoId), String(Math.floor(seconds)))
}

function clearSavedSeconds(topicId: string, videoId: string) {
    window.localStorage.removeItem(getProgressKey(topicId, videoId))
}

function ensureUrlParam(src: string, key: string, value: string) {
    const url = new URL(src)
    url.searchParams.set(key, value)
    return url.href
}



function bindDirectVideoProgress(root: HTMLElement, topicId: string) {
    return Array.from(root.querySelectorAll("video")).map((video) => {
        const videoId = video.currentSrc || video.src
        const restore = () => {
            const savedSeconds = getSavedSeconds(topicId, videoId)
            if (savedSeconds > 0 && (!video.duration || savedSeconds < video.duration - 2)) {
                video.currentTime = savedSeconds
            }
        }
        const save = () => saveSeconds(topicId, videoId, video.currentTime)
        const clear = () => clearSavedSeconds(topicId, videoId)

        video.addEventListener("loadedmetadata", restore)
        video.addEventListener("timeupdate", save)
        video.addEventListener("pause", save)
        video.addEventListener("ended", clear)

        if (video.readyState >= 1) restore()

        return () => {
            if (!video.ended) save()
            video.removeEventListener("loadedmetadata", restore)
            video.removeEventListener("timeupdate", save)
            video.removeEventListener("pause", save)
            video.removeEventListener("ended", clear)
        }
    })
}

function bindYouTubeProgress(root: HTMLElement, topicId: string, onCleanup: (cleanup: () => void) => void) {
    const frames = Array.from(
        root.querySelectorAll<HTMLIFrameElement>('iframe[src*="youtube.com/embed"]')
    )
    if (frames.length === 0) return

    let cancelled = false
    loadYouTubeApi().then((api) => {
        if (cancelled) return

        frames.forEach((frame) => {
            frame.src = ensureUrlParam(frame.src, "enablejsapi", "1")
            const videoId = frame.src
            let saveInterval: number | null = null

            const player = new api.Player(frame, {
                events: {
                    onReady: (event) => {
                        const savedSeconds = getSavedSeconds(topicId, videoId)
                        if (savedSeconds > 0) {
                            event.target.seekTo(savedSeconds, true)
                        }
                    },
                    onStateChange: (event) => {
                        if (event.data === 1 && saveInterval === null) {
                            saveInterval = window.setInterval(() => {
                                saveSeconds(topicId, videoId, event.target?.getCurrentTime())
                            }, 2000)
                        }

                        if (event.data === 2) {
                            saveSeconds(topicId, videoId, event.target?.getCurrentTime())
                            if (saveInterval !== null) {
                                window.clearInterval(saveInterval)
                                saveInterval = null
                            }
                        }

                        if (event.data === 0) {
                            clearSavedSeconds(topicId, videoId)
                            if (saveInterval !== null) {
                                window.clearInterval(saveInterval)
                                saveInterval = null
                            }
                        }
                    },
                },
            })

            onCleanup(() => {
                if (saveInterval !== null) {
                    window.clearInterval(saveInterval)
                }
                if (player?.getCurrentTime)
                    saveSeconds(topicId, videoId, player?.getCurrentTime())
                player.destroy()
            })
        })
    })

    onCleanup(() => {
        cancelled = true
    })
}

function bindVimeoProgress(root: HTMLElement, topicId: string, onCleanup: (cleanup: () => void) => void) {
    const frames = Array.from(
        root.querySelectorAll<HTMLIFrameElement>('iframe[src*="player.vimeo.com/video"]')
    )
    if (frames.length === 0) return

    const send = (frame: HTMLIFrameElement, method: string, value?: string | number) => {
        const origin = new URL(frame.src).origin
        frame.contentWindow?.postMessage(JSON.stringify({ method, value }), origin)
    }

    frames.forEach((frame, index) => {
        const playerId = `topic-vimeo-${topicId}-${index}`
        frame.src = ensureUrlParam(ensureUrlParam(frame.src, "api", "1"), "player_id", playerId)
        const videoId = frame.src

        const handleMessage = (event: MessageEvent) => {
            if (event.source !== frame.contentWindow || !String(event.origin).includes("vimeo.com")) {
                return
            }

            let payload: {
                event?: string
                data?: { seconds?: number }
            }

            try {
                payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data
            } catch {
                return
            }

            if (payload.event === "ready") {
                send(frame, "addEventListener", "playProgress")
                send(frame, "addEventListener", "pause")
                send(frame, "addEventListener", "ended")

                const savedSeconds = getSavedSeconds(topicId, videoId)
                if (savedSeconds > 0) {
                    send(frame, "setCurrentTime", savedSeconds)
                }
            }

            if (payload.event === "playProgress" && typeof payload.data?.seconds === "number") {
                saveSeconds(topicId, videoId, payload.data.seconds)
            }

            if (payload.event === "ended") {
                clearSavedSeconds(topicId, videoId)
            }
        }

        window.addEventListener("message", handleMessage)
        onCleanup(() => window.removeEventListener("message", handleMessage))
    })
}

function bindVideoProgress(root: HTMLElement, topicId: string) {
    const cleanup = bindDirectVideoProgress(root, topicId)
    bindYouTubeProgress(root, topicId, (item) => cleanup.push(item))
    bindVimeoProgress(root, topicId, (item) => cleanup.push(item))

    return () => {
        cleanup.forEach((item) => item())
    }
}

function getVideoEmbedHtml(rawUrl: string): string | null {
    const trimmed = rawUrl.trim()
    if (!trimmed) return null

    let url: URL
    try {
        url = new URL(trimmed)
    } catch {
        return null
    }

    if (!["http:", "https:"].includes(url.protocol)) {
        return null
    }

    const host = url.hostname.replace(/^www\./, "")
    let embedUrl = ""

    if (host === "youtube.com" || host === "m.youtube.com") {
        const id = url.searchParams.get("v") ?? url.pathname.split("/").filter(Boolean).at(-1)
        if (id) embedUrl = `https://www.youtube.com/embed/${encodeURIComponent(id)}?enablejsapi=1`
    } else if (host === "youtu.be") {
        const id = url.pathname.split("/").filter(Boolean)[0]
        if (id) embedUrl = `https://www.youtube.com/embed/${encodeURIComponent(id)}?enablejsapi=1`
    } else if (host === "vimeo.com" || host === "player.vimeo.com") {
        const id = url.pathname.split("/").filter(Boolean).at(-1)
        if (id) embedUrl = `https://player.vimeo.com/video/${encodeURIComponent(id)}`
    }

    if (embedUrl) {
        return `<div class="topic-video-embed"><iframe src="${embedUrl}" title="Embedded topic video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`
    }

    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url.href)) {
        return `<div class="topic-video-embed"><video src="${url.href}" controls></video></div>`
    }

    return null
}

function formatContent(content: string): string {
    const contentWithVideoEmbeds = content
        .split(/\n/)
        .map((line) => getVideoEmbedHtml(line) ?? line)
        .join("\n")

    // Convert markdown-like syntax to HTML
    const formatted = contentWithVideoEmbeds
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br/>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/### (.*?)(?=<|$)/g, '<h3>$1</h3>')
        .replace(/## (.*?)(?=<|$)/g, '<h2>$1</h2>')
        .replace(/# (.*?)(?=<|$)/g, '<h1>$1</h1>')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

    return `<p>${formatted}</p>`
}

function extractKeyPoint(question: string): string {
    // Extract the main concept from a question
    const cleaned = question.replace(/^(What|Which|How|Why|When|Where)\s+(is|are|does|do|can|could|would|should)\s+/i, '')
    return cleaned.length > 100 ? cleaned.substring(0, 100) + '...' : cleaned
}
