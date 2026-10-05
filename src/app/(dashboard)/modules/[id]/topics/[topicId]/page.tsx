"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
    Lock,
    FileText,
    Video,
    Code2,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { useCourseCrumb } from "@/components/modules/use-course-crumb"
import FlashcardDeck from "@/components/modules/flash-card-decks"
import { TopicProjects, type TopicProjectSummary } from "@/components/projects/topic-projects"
import { TopicPdfReader } from "@/components/modules/topic-pdf-reader"
import { Modal } from "@/components/admin/modal"
import { Input } from "@/components/ui/input"
import { MathText } from "@/components/ui/math-text"
import { TopicContentView } from "@/components/topic/topic-content-view"
import { AdSenseScript } from "@/components/ads/adsense-script"
import { renderTopicContent, splitTopicVideos } from "@/lib/topic-content"

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
    const courseCrumb = useCourseCrumb(params.id as string)
    const router = useRouter()
    const { data: session } = useSession()
    const [topic, setTopic] = useState<Topic | null>(null)
    const [progress, setProgress] = useState<UserProgress | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isStartingQuiz, setIsStartingQuiz] = useState(false)
    const [activeTab, setActiveTab] = useState("content")
    // Coding projects (coding modules)
    const [projects, setProjects] = useState<TopicProjectSummary[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [assignmentIsOpen, setAssignmentIsOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [code, setCode] = useState<string | null>(null)
    const [result, setResult] = useState<AssignmentResult | null>(null)
    const [assignmentSubmissionLoading, setAssignmentSubmissionLoading] = useState(false)
    const topicId = params.topicId as string
    // Set when the topic is locked for this student (previous quiz not passed yet)
    const [lockedInfo, setLockedInfo] = useState<{ previousTopic: { id: string; title: string }; passMark: number } | null>(null)

    // Fetch topic data
    useEffect(() => {
        const fetchTopic = async () => {
            try {
                const response = await fetch(`/api/topics/${topicId}`)
                if (response.status === 403) {
                    const data = await response.json().catch(() => ({}))
                    if (data.locked && data.previousTopic) {
                        setLockedInfo({ previousTopic: data.previousTopic, passMark: data.passMark ?? 70 })
                        return
                    }
                }
                if (!response.ok) throw new Error("Failed to fetch topic")
                const data: Topic = await response.json()
                setTopic(data)
                setActiveTab("content")
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

        const fetchProjects = async () => {
            const response = await fetch(`/api/topics/${topicId}/projects`).catch(() => null)
            if (response?.ok) setProjects((await response.json()).projects ?? [])
        }

        if (topicId) {
            fetchTopic()
            fetchProgress()
            fetchProjects()
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

    if (lockedInfo) {
        const moduleId = params.id as string
        return (
            <div data-page-bg="white" className="container mx-auto max-w-xl px-4 py-16 text-center">
                <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-orange-700">
                    <Lock className="h-7 w-7" />
                </span>
                <h1 className="text-2xl font-semibold tracking-tight">This topic is locked</h1>
                <p className="mt-2 text-muted-foreground">
                    Pass the <span className="font-medium text-foreground">{lockedInfo.previousTopic.title}</span> quiz
                    with {lockedInfo.passMark}% or more to open it.
                </p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                    <Button asChild variant="primary">
                        <Link href={`/modules/${moduleId}/topics/${lockedInfo.previousTopic.id}`}>
                            Go to {lockedInfo.previousTopic.title}
                        </Link>
                    </Button>
                    <Button asChild variant="default">
                        <Link href={`/modules/${moduleId}`}>Back to module</Link>
                    </Button>
                </div>
            </div>
        )
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
    // Videos placed in the lesson get their own tab
    const { lesson: lessonHtml, videos } = splitTopicVideos(renderTopicContent(topic.content))
    const hasVideo = videos.length > 0
    const hasLesson = lessonHtml.replace(/<[^>]+>/g, "").trim().length > 0 || /<img/i.test(lessonHtml)
    const hasProjects = projects.length > 0
    const tabCount = 1 + Number(hasVideo) + Number(hasPdfs) + Number(hasFlashcards) + Number(hasQuestions) + Number(hasProjects)
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
        // data-page-bg="white": the app background turns white while this page is open (globals.css)
        <div data-page-bg="white">
            {/* Ads only where there's a real lesson to read */}
            {hasLesson && <AdSenseScript />}
            <div className="container max-w-4xl mx-auto px-4 ">
                <Breadcrumbs
                    items={[
                        ...courseCrumb,
                        { label: topic.chapter.module.title, href: `/modules/${topic.chapter.module.id}` },
                        { label: topic.chapter.title, href: `/modules/${topic.chapter.module.id}/chapters/${topic.chapter.id}` },
                        { label: topic.title },
                    ]}
                />
            </div>

            <div className="container max-w-4xl mx-auto px-4 ">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList
                        className="grid w-full border border-foreground shadow-none"
                        style={{ gridTemplateColumns: `repeat(${tabCount}, minmax(0, 1fr))` }}
                    >
                        <TabsTrigger value="content" className="gap-2 px-2">
                            <BookOpen className="hidden h-4 w-4 sm:block" />
                            <span>Lesson</span>
                        </TabsTrigger>
                        {hasVideo && (
                            <TabsTrigger value="video" className="gap-2 px-2">
                                <Video className="hidden h-4 w-4 sm:block" />
                                <span>Video</span>
                            </TabsTrigger>
                        )}
                        {hasPdfs && (
                            <TabsTrigger value="pdf" className="gap-2 px-2">
                                <FileText className="hidden h-4 w-4 sm:block" />
                                <span>PDF</span>
                            </TabsTrigger>
                        )}
                        {hasFlashcards && (
                            <TabsTrigger value="flashcards" className="gap-2 px-2">
                                <Sparkles className="hidden h-4 w-4 sm:block" />
                                <span>Flashcards</span>
                            </TabsTrigger>
                        )}
                        {hasProjects && (
                            <TabsTrigger value="projects" className="gap-2 px-2">
                                <Code2 className="hidden h-4 w-4 sm:block" />
                                <span>Projects</span>
                            </TabsTrigger>
                        )}
                        {hasQuestions && (
                            <TabsTrigger value="quiz-prep" className="gap-2 px-2">
                                <PlayCircle className="hidden h-4 w-4 sm:block" />
                                <span>Quiz Prep</span>
                            </TabsTrigger>
                        )}
                    </TabsList>

                    <TabsContent value="content">
                        <Sheet>
                            {/* The lesson, as written in the app (videos are in the Video tab) */}
                            <TopicContentView
                                content={topic.content}
                                part="lesson"
                                empty={
                                    hasPdfs ? "This topic's material is in the PDF tab."
                                        : hasVideo ? "Watch the video for this topic in the Video tab."
                                            : "No content available for this topic yet."
                                }
                            />

                            {hasQuestions && (
                                <Section title="Key takeaways" description="What you should know before taking the quiz.">
                                    <ul className="space-y-2">
                                        {topic.questions.slice(0, 5).map((question) => (
                                            <li key={question.id} className="flex items-start gap-2">
                                                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                                                <span className="text-sm"><MathText text={extractKeyPoint(question.question)} /></span>
                                            </li>
                                        ))}
                                    </ul>
                                </Section>
                            )}
                        </Sheet>
                    </TabsContent>

                    {hasVideo && (
                        <TabsContent value="video">
                            <Sheet>
                                <SheetHeading
                                    title={videos.length > 1 ? "Videos" : "Video"}
                                    description="Watch, pause and rewind as often as you need."
                                />
                                <TopicContentView content={topic.content} part="videos" />
                            </Sheet>
                        </TabsContent>
                    )}

                    {hasPdfs && (
                        <TabsContent value="pdf">
                            <Sheet>
                                <SheetHeading title="PDF" description="Textbook pages and notes for this topic." />
                                <TopicPdfReader topicId={topic.id} />
                            </Sheet>
                        </TabsContent>
                    )}

                    {/* Flashcards Tab */}
                    {hasFlashcards && (
                        <TabsContent value="flashcards">
                            <Sheet>
                                <SheetHeading title="Study flashcards" description="Review these flashcards to reinforce your learning." />
                                <FlashcardDeck flashcards={topic.flashcards} />
                            </Sheet>
                        </TabsContent>
                    )}

                    {/* Coding projects: upload your code, the AI marks it */}
                    {hasProjects && (
                        <TabsContent value="projects">
                            <Sheet>
                                <SheetHeading
                                    title="Coding projects"
                                    description="Write the program on your computer, then upload your files. The AI marks your code against each project's rubric and tells you what to improve."
                                />
                                <TopicProjects projects={projects} moduleId={topic.chapter.module.id} topicId={topic.id} />
                            </Sheet>
                        </TabsContent>
                    )}

                    {/* Quiz Preparation Tab */}
                    <TabsContent value="quiz-prep">
                        <Sheet>
                            <SheetHeading
                                title="Ready to test your knowledge?"
                                description={hasQuestions
                                        ? topic.questions.length > 20
                                            ? `Each quiz picks 20 of this topic's ${topic.questions.length} questions at random, so every attempt is different.`
                                            : `This quiz contains ${topic.questions.length} questions covering all the key concepts.`
                                        : "No questions available for this topic yet."}
                            />
                            <div className="space-y-4">
                                {hasQuestions && (
                                    <>
                                        <div className="bg-muted/50 rounded-lg p-4">
                                            <h3 className="font-semibold mb-2">Quiz Information:</h3>
                                            <ul className="space-y-2 text-sm">
                                                <li className="flex items-center gap-2">
                                                    <FileQuestion className="h-4 w-4 text-primary" />
                                                    <span>{Math.min(topic.questions.length, 20)} multiple-choice questions per quiz</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-primary" />
                                                    <span>No time limit. A timer shows how long you take</span>
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
                                                variant="primary"
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
                            </div>
                        </Sheet>
                    </TabsContent>
                </Tabs>
                {topic.assignment && <Button className="float-end" onClick={toggle}>Attempt Assignment</Button>}
                <Modal open={isOpen} onClose={toggle} size="lg">
                    <Card className="h-full">
                        <div className="text-2xl pb-5">Assignment</div>
                        {assignmentSubmissionLoading ? <div>
                            <div>PLEASE WAIT WHILE WE PROCESS YOUR SUBMISSION...</div>
                        </div> : <div>
                            <TopicContentView content={topic.assignment} empty="No assignment instructions yet." />
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

function extractKeyPoint(question: string): string {
    // Extract the main concept from a question
    const cleaned = question.replace(/^(What|Which|How|Why|When|Where)\s+(is|are|does|do|can|could|would|should)\s+/i, '')
    return cleaned.length > 100 ? cleaned.substring(0, 100) + '...' : cleaned
}

/** Each tab's content, laid straight onto the white page */
function Sheet({ children }: { children: React.ReactNode }) {
    return (
        <div className="px-1 py-2 sm:px-2">
            {children}
        </div>
    )
}

function SheetHeading({ title, description }: { title: string; description?: string }) {
    return (
        <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
    )
}

/** A later part of the same page, set off by a thin rule instead of a card */
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
    return (
        <section className="mt-10 border-t border-border pt-8">
            <SheetHeading title={title} description={description} />
            {children}
        </section>
    )
}
