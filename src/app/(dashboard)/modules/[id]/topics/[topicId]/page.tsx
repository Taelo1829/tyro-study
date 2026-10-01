"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
    Sparkles,
    FileText,
    Video
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import FlashcardDeck from "@/components/modules/flash-card-decks"
import { TopicPdfReader } from "@/components/modules/topic-pdf-reader"
import { Modal } from "@/components/admin/modal"
import { Input } from "@/components/ui/input"

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
    pdfs: Array<{
        id: string
        title: string
        url: string
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

interface AssignmentResult {
    passed: boolean
    percentage: number
    summary: string
    suggestions?: string[]
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
    const [result, setResult] = useState<AssignmentResult | null>(null)
    const [assignmentSubmissionLoading, setAssignmentSubmissionLoading] = useState(false)
    const topicId = params.topicId as string

    // Fetch topic data
    useEffect(() => {
        const fetchTopic = async () => {
            try {
                const response = await fetch(`/api/topics/${topicId}`)
                if (!response.ok) throw new Error("Failed to fetch topic")
                const data: Topic = await response.json()
                setTopic(data)
                // Open the Video tab first when the topic has both a video and PDFs.
                // (Done here rather than in a separate effect: an effect placed after
                // the early returns below broke React's rules of hooks and crashed the page.)
                const dataHasVideo = !!data.content && detectVideoInContent(data.content)
                const dataHasPdfs = (data.pdfs?.length ?? 0) > 0
                setActiveTab(dataHasVideo && dataHasPdfs ? "video" : "content")
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

    const handleStartQuiz = async () => {
        if (!topic?.questions?.length) {
            toast.warning("No Questions", "This topic doesn't have any questions yet.")
            return
        }

        // The quiz page creates (and saves) its own attempt. Creating one here as
        // well left an extra, never-finished attempt behind every time.
        setIsStartingQuiz(true)
        router.push(`/modules/${topic.chapter.module.id}/topics/${topic.id}/quiz`)
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
    const hasPdfs = topic.pdfs?.length > 0
    const hasVideo = !!topic.content && detectVideoInContent(topic.content)
    const isAdmin = session?.user?.role === "ADMIN"

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
        } catch (err) {
            toast.error(
                "Submission failed",
                err instanceof Error ? err.message : "Something went wrong. Please try again."
            )
        } finally {
            setAssignmentSubmissionLoading(false)
        }
    }

    async function navigateToNextTopic() {
        router.push(`/modules/${topic?.chapter.module.id}/topics/${topic?.nextTopic}`)
    }

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
                        {hasVideo && hasPdfs && (
                            <TabsTrigger value="video" className="space-x-2">
                                <Video className="h-4 w-4" />
                                <span>Video</span>
                            </TabsTrigger>
                        )}
                        {hasVideo && hasPdfs && (
                            <TabsTrigger value="pdf" className="space-x-2">
                                <FileText className="h-4 w-4" />
                                <span>PDF</span>
                            </TabsTrigger>
                        )}
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
                                <div className="topic-content">
                                    {topic.content ? (
                                        <div
                                            ref={contentRef}
                                            dangerouslySetInnerHTML={{ __html: formatContent(hasVideo ? removeVideoFromContent(topic.content) : topic.content) }}
                                        />
                                    ) : (
                                        <p className="text-muted-foreground italic">
                                            No content available for this topic yet.
                                        </p>
                                    )}
                                </div>
                                {!hasVideo && hasPdfs && <TopicPdfReader topicId={topic.id} />}
                                {hasVideo && !hasPdfs && (
                                    <div className="topic-content mt-6">
                                        {topic.content ? (
                                            <div
                                                dangerouslySetInnerHTML={{ __html: formatContent(extractVideoFromContent(topic.content)) }}
                                            />
                                        ) : null}
                                    </div>
                                )}
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

                    {/* Video Tab */}
                    {hasVideo && hasPdfs && (
                        <TabsContent value="video" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Video Content</CardTitle>
                                    <CardDescription>
                                        Watch the video to learn about this topic.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="topic-content">
                                        {topic.content ? (
                                            <div
                                                dangerouslySetInnerHTML={{ __html: formatContent(extractVideoFromContent(topic.content)) }}
                                            />
                                        ) : (
                                            <p className="text-muted-foreground italic">
                                                No video content available for this topic yet.
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )}

                    {/* PDF Tab */}
                    {hasVideo && hasPdfs && (
                        <TabsContent value="pdf" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>PDF Content</CardTitle>
                                    <CardDescription>
                                        Read through the PDF material for additional context.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <TopicPdfReader topicId={topic.id} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )}

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
                                        ? topic.questions.length > 10
                                            ? `Each quiz picks 10 of this topic's ${topic.questions.length} questions, starting with ones you haven't done yet.`
                                            : `This quiz contains ${topic.questions.length} questions covering all the key concepts.`
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
                                                    <span>{Math.min(topic.questions.length, 10)} multiple-choice questions per quiz</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-primary" />
                                                    <span>No time limit — a timer shows how long you take</span>
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

                                        {!!progress && progress.quizAttempts > 0 && (
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
                                        {isAdmin && (
                                            <Button
                                                variant="default"
                                                className="mt-4"
                                                onClick={() => router.push(`/admin/topics/${topic.id}`)}
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
                            <div className="topic-content" dangerouslySetInnerHTML={{ __html: topic.assignment || "" }}></div>
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
                        {result?.passed && topic.nextTopic && <Button className="float-end" onClick={navigateToNextTopic}>Next Topic</Button>}
                    </div>
                </Card>
            </Modal>
        </div>
    )
}

// Helper Functions


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

function detectVideoInContent(content: string): boolean {
    const lines = content.split('\n')
    for (const line of lines) {
        if (getVideoEmbedHtml(line) !== null) {
            return true
        }
    }
    return false
}

function extractVideoFromContent(content: string): string {
    const lines = content.split('\n')
    const videoLines = lines.filter(line => getVideoEmbedHtml(line) !== null)
    if (videoLines.length === 0) return content
    return videoLines.map(line => getVideoEmbedHtml(line) ?? line).join('\n')
}

function removeVideoFromContent(content: string): string {
    const lines = content.split('\n')
    const nonVideoLines = lines.filter(line => getVideoEmbedHtml(line) === null)
    if (nonVideoLines.length === lines.length) return content
    return nonVideoLines.join('\n')
}
