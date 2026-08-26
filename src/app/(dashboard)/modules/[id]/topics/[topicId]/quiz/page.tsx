"use client";

import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

type Answer = {
    id: string;
    answer: string;
    isCorrect: boolean;
};

type Question = {
    id: string;
    question: string;
    difficulty: string;
    answers: Answer[];
};

type TopicData = {
    id: string;
    title: string;
    content: string;
    questions: Question[];
};

export default function QuizPage() {
    const params = useParams();
    const router = useRouter();
    const topicId = params.topicId;

    const [topic, setTopic] = useState<TopicData | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
    const [showResults, setShowResults] = useState(false);
    const [score, setScore] = useState(0);

    useEffect(() => {
        // Fetch topic data from API
        const fetchTopic = async () => {
            try {
                const response = await fetch(`/api/topics/${topicId}`);
                const data = await response.json();
                setTopic(data);
            } catch (error) {
                console.error("Error fetching topic:", error);
            } finally {
                setLoading(false);
            }
        };

        if (topicId) {
            fetchTopic();
        }
    }, [topicId]);

    const handleAnswerSelect = (questionId: string, answerId: string) => {
        setSelectedAnswers((prev) => ({
            ...prev,
            [questionId]: answerId,
        }));
    };

    const handleNext = () => {
        if (topic && currentQuestionIndex < topic.questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        }
    };

    const handlePrevious = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(currentQuestionIndex - 1);
        }
    };

    const handleSubmit = () => {
        if (!topic) return;

        let correctCount = 0;
        topic.questions.forEach((question) => {
            const selectedAnswerId = selectedAnswers[question.id];
            const correctAnswer = question.answers.find((a) => a.isCorrect);
            if (selectedAnswerId && correctAnswer && selectedAnswerId === correctAnswer.id) {
                correctCount++;
            }
        });
        setScore(correctCount);
        setShowResults(true);
    };

    const handleRestart = () => {
        setSelectedAnswers({});
        setCurrentQuestionIndex(0);
        setShowResults(false);
        setScore(0);
    };

    const handleBackToTopic = () => {
        router.push(`/topics/${topicId}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                    <p className="mt-4 text-muted-foreground">Loading quiz...</p>
                </div>
            </div>
        );
    }

    if (!topic) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <p className="text-red-400">Topic not found</p>
                    <button
                        onClick={() => router.back()}
                        className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-neo neo-button hover:opacity-90"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (showResults) {
        const percentage = (score / topic.questions.length) * 100;
        let message = "";
        let messageColor = "";

        if (percentage >= 80) {
            message = "Excellent! You've mastered this topic! 🎉";
            messageColor = "text-accent";
        } else if (percentage >= 60) {
            message = "Good job! A bit more practice and you'll get it! 📚";
            messageColor = "text-primary";
        } else if (percentage >= 40) {
            message = "Not bad! Review the material and try again! 💪";
            messageColor = "text-yellow-400";
        } else {
            message = "Keep studying! Review the topic and take the quiz again! 📖";
            messageColor = "text-red-400";
        }

        return (
            <div className="min-h-screen py-12 px-4 bg-background">
                <div className="max-w-3xl mx-auto">
                    <div className="neo-flat p-8">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full neo-pressed mb-6">
                                <span className="text-4xl">📊</span>
                            </div>
                            <h1 className="text-3xl font-bold mb-2 text-foreground">Quiz Results</h1>
                            <p className="text-muted-foreground mb-6">{topic.title}</p>

                            <div className="text-6xl font-bold text-primary mb-4">
                                {score}/{topic.questions.length}
                            </div>

                            <div className="w-full neo-inset rounded-full h-3 mb-6">
                                <div
                                    className="bg-primary h-3 rounded-full transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>

                            <p className={`text-lg font-medium mb-8 ${messageColor}`}>
                                {message}
                            </p>

                            <div className="flex gap-4 justify-center">
                                <button
                                    onClick={handleRestart}
                                    className="px-6 py-3 bg-primary text-primary-foreground rounded-neo neo-button font-medium hover:opacity-90 transition-all"
                                >
                                    Take Quiz Again
                                </button>
                                <button
                                    onClick={handleBackToTopic}
                                    className="px-6 py-3 text-foreground rounded-neo neo-button font-medium hover:opacity-90 transition-all"
                                >
                                    Back to Topic
                                </button>
                            </div>
                        </div>

                        {/* Detailed results */}
                        <div className="mt-12 border-t border-[var(--neo-shadow-light)] pt-8">
                            <h2 className="text-xl font-bold mb-4 text-foreground">Detailed Review</h2>
                            <div className="space-y-4">
                                {topic.questions.map((question, idx) => {
                                    const selectedAnswerId = selectedAnswers[question.id];
                                    const selectedAnswer = question.answers.find(a => a.id === selectedAnswerId);
                                    const correctAnswer = question.answers.find(a => a.isCorrect);
                                    const isCorrect = selectedAnswerId === correctAnswer?.id;

                                    return (
                                        <div key={question.id} className="neo-inset p-4">
                                            <div className="flex items-start gap-3">
                                                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${isCorrect ? "bg-green-900/40 text-accent" : "bg-red-900/40 text-red-400"
                                                    }`}>
                                                    {isCorrect ? "✓" : "✗"}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-medium mb-2 text-foreground">
                                                        {idx + 1}. {question.question}
                                                    </p>
                                                    <div className="text-sm text-muted-foreground">
                                                        <p>Your answer: {selectedAnswer?.answer || "Not answered"}</p>
                                                        {!isCorrect && (
                                                            <p className="text-accent mt-1">
                                                                Correct answer: {correctAnswer?.answer}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const currentQuestion = topic.questions[currentQuestionIndex];
    const hasSelectedAnswer = !!selectedAnswers[currentQuestion.id];
    const isLastQuestion = currentQuestionIndex === topic.questions.length - 1;
    const allQuestionsAnswered = topic.questions.every(q => selectedAnswers[q.id]);

    return (
        <div className="min-h-screen bg-background px-4 py-12">
            <div className="max-w-4xl mx-auto">
              {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={handleBackToTopic}
                        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                        ← Back to Topic
                    </button>
                    <div className="neo-flat p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h1 className="text-2xl font-bold text-foreground">{topic.title}</h1>
                            <span className="text-sm text-muted-foreground">
                                Question {currentQuestionIndex + 1} of {topic.questions.length}
                            </span>
                        </div>
                        <div className="neo-inset h-2 w-full overflow-hidden rounded-full">
                            <div
                                className="h-2 rounded-full bg-primary transition-all duration-300"
                                style={{ width: `${((currentQuestionIndex + 1) / topic.questions.length) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Question Card */}
                <div className="neo-flat mb-6 p-8">
                    <div className="mb-6">
                        <div className="neo-pressed mb-4 inline-block rounded-full px-3 py-1 text-xs font-medium text-muted-foreground">
                            {currentQuestion.difficulty.toUpperCase()}
                        </div>
                        <h2 className="text-xl font-semibold text-foreground">{currentQuestion.question}</h2>
                    </div>

                    {/* Answers */}
                    <div className="space-y-3">
                        {currentQuestion.answers.map((answer) => {
                            const isSelected = selectedAnswers[currentQuestion.id] === answer.id;
                            return (
                                <button
                                    key={answer.id}
                                    onClick={() => handleAnswerSelect(currentQuestion.id, answer.id)}
                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${isSelected
                                    ? "border-primary bg-primary/10"
                                            : "border-[var(--neo-shadow-light)] hover:bg-[var(--neo-shadow-light)]/30"
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                                            }`}>
                                            {isSelected && <div className="h-2 w-2 rounded-full bg-[var(--neo-primary-foreground)]" />}
                                        </div>
                                        <span className="flex-1 text-foreground">{answer.answer}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-between gap-4">
                    <button
                        onClick={handlePrevious}
                        disabled={currentQuestionIndex === 0}
                        className={`px-6 py-3 rounded-xl font-medium transition-all ${currentQuestionIndex === 0
                                ? "neo-inset cursor-not-allowed text-muted-foreground"
                                : "neo-button text-foreground hover:opacity-90"
                            }`}
                    >
                        Previous
                    </button>

                    {!isLastQuestion ? (
                        <button
                            onClick={handleNext}
                            disabled={!hasSelectedAnswer}
                            className={`px-6 py-3 rounded-xl font-medium transition-all ${hasSelectedAnswer
                                    ? "neo-button bg-primary text-primary-foreground hover:opacity-90"
                                    : "neo-inset cursor-not-allowed text-muted-foreground"
                                }`}
                        >
                            Next Question
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={!allQuestionsAnswered}
                            className={`px-8 py-3 rounded-xl font-medium transition-all ${allQuestionsAnswered
                                    ? "neo-button bg-primary text-primary-foreground hover:opacity-90"
                                    : "neo-inset cursor-not-allowed text-muted-foreground"
                                }`}
                        >
                            Submit Quiz
                        </button>
                    )}
                </div>

                {/* Progress Indicator */}
                <div className="mt-6 text-center text-sm text-muted-foreground">
                    {Object.keys(selectedAnswers).length} of {topic.questions.length} questions answered
                </div>
            </div>
        </div>
    );
}
