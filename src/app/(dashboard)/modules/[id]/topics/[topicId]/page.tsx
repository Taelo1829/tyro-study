"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
    BookOpen,
    Clock,
    Trophy,
    Calendar,
    User,
    CheckCircle,
    XCircle,
    AlertCircle,
    Loader2,
    ArrowLeft,
    PlayCircle,
    FileQuestion,
    Sparkles
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { Header } from "@/components/layout/header"

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
}

interface UserProgress {
    completed: boolean
    quizAttempts: number
    bestScore: number
    lastAttemptAt: string | null
}

export default function TopicPage() {
    const params = useParams()
    const router = useRouter()
    const { data: session } = useSession()
    const [topic, setTopic] = useState<Topic | null>(null)
    const [progress, setProgress] = useState<UserProgress | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isStartingQuiz, setIsStartingQuiz] = useState(false)
    const [activeTab, setActiveTab] = useState("content")

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

            const data = await response.json()

            // Navigate to quiz page
            router.push(`/quiz/${data.attemptId}`)
        } catch (error) {
            console.error("Error starting quiz:", error)
            toast.error("Error", "Failed to start quiz. Please try again.")
        } finally {
            setIsStartingQuiz(false)
        }
    }

    if (isLoading) {
        return <TopicSkeleton />
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
                        <TabsTrigger value="quiz-prep" className="space-x-2">
                            <PlayCircle className="h-4 w-4" />
                            <span>Quiz Preparation</span>
                        </TabsTrigger>
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
                                        <div dangerouslySetInnerHTML={{ __html: formatContent(topic.content) }} />
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
                                        Here's what you should know before taking the quiz.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2">
                                        {topic.questions.slice(0, 5).map((question, index) => (
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
                                                    You've attempted this quiz {progress.quizAttempts} time(s).
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
            </div>
        </div>
    )
}

// Flashcard Deck Component
function FlashcardDeck({ flashcards }: { flashcards: Array<{ id: string; front: string; back: string }> }) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isFlipped, setIsFlipped] = useState(false)

    const currentCard = flashcards[currentIndex]

    const nextCard = () => {
        setIsFlipped(false)
        setCurrentIndex((prev) => (prev + 1) % flashcards.length)
    }

    const prevCard = () => {
        setIsFlipped(false)
        setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length)
    }

    if (flashcards.length === 0) return null

    return (
        <div className="space-y-4">
            <div className="text-center text-sm text-muted-foreground">
                Card {currentIndex + 1} of {flashcards.length}
            </div>

            <div
                className="relative cursor-pointer perspective-1000"
                onClick={() => setIsFlipped(!isFlipped)}
            >
                <div className={cn(
                    "relative w-full min-h-[300px] transition-transform duration-500 transform-style-3d",
                    isFlipped && "rotate-y-180"
                )}>
                    {/* Front */}
                    <div className="absolute inset-0 backface-hidden">
                        <Card className="h-full flex items-center justify-center p-8 hover:shadow-lg transition-shadow">
                            <div className="text-center">
                                <Badge className="mb-4">Front</Badge>
                                <p className="text-lg">{currentCard.front}</p>
                                <p className="text-sm text-muted-foreground mt-4">Click to flip</p>
                            </div>
                        </Card>
                    </div>

                    {/* Back */}
                    <div className="absolute inset-0 backface-hidden rotate-y-180">
                        <Card className="h-full flex items-center justify-center p-8 bg-primary/5 hover:shadow-lg transition-shadow">
                            <div className="text-center">
                                <Badge variant="secondary" className="mb-4">Back</Badge>
                                <p className="text-lg">{currentCard.back}</p>
                                <p className="text-sm text-muted-foreground mt-4">Click to flip back</p>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

            <div className="flex justify-between gap-4">
                <Button onClick={prevCard} variant="default" className="flex-1">
                    Previous
                </Button>
                <Button onClick={nextCard} className="flex-1">
                    Next Card
                </Button>
            </div>
        </div>
    )
}

// Loading Skeleton
function TopicSkeleton() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            <div className="container max-w-4xl mx-auto px-4 py-8">
                <Skeleton className="h-8 w-32 mb-8" />
                <Skeleton className="h-12 w-3/4 mb-4" />
                <div className="flex gap-4 mb-8">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-32" />
                </div>
                <Skeleton className="h-64 w-full mb-6" />
                <Skeleton className="h-48 w-full" />
            </div>
        </div>
    )
}

// Helper Functions
function formatContent(content: string): string {
    // Convert markdown-like syntax to HTML
    let formatted = content
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