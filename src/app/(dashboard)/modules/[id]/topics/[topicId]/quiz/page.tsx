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
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                <div className="text-center">
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                    <p className="mt-4 text-gray-600">Loading quiz...</p>
                </div>
            </div>
        );
    }

    if (!topic) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                <div className="text-center">
                    <p className="text-red-600">Topic not found</p>
                    <button
                        onClick={() => router.back()}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
            messageColor = "text-green-600";
        } else if (percentage >= 60) {
            message = "Good job! A bit more practice and you'll get it! 📚";
            messageColor = "text-blue-600";
        } else if (percentage >= 40) {
            message = "Not bad! Review the material and try again! 💪";
            messageColor = "text-yellow-600";
        } else {
            message = "Keep studying! Review the topic and take the quiz again! 📖";
            messageColor = "text-red-600";
        }

        return (
            <div className="min-h-screen py-12 px-4 bg-gradient-to-br from-gray-50 to-gray-100">
                <div className="max-w-3xl mx-auto">
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 mb-6">
                                <span className="text-4xl">📊</span>
                            </div>
                            <h1 className="text-3xl font-bold mb-2">Quiz Results</h1>
                            <p className="text-gray-600 mb-6">{topic.title}</p>

                            <div className="text-6xl font-bold text-blue-600 mb-4">
                                {score}/{topic.questions.length}
                            </div>

                            <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
                                <div
                                    className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>

                            <p className={`text-lg font-medium mb-8 ${messageColor}`}>
                                {message}
                            </p>

                            <div className="flex gap-4 justify-center">
                                <button
                                    onClick={handleRestart}
                                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all"
                                >
                                    Take Quiz Again
                                </button>
                                <button
                                    onClick={handleBackToTopic}
                                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-all"
                                >
                                    Back to Topic
                                </button>
                            </div>
                        </div>

                        {/* Detailed results */}
                        <div className="mt-12 border-t pt-8">
                            <h2 className="text-xl font-bold mb-4">Detailed Review</h2>
                            <div className="space-y-4">
                                {topic.questions.map((question, idx) => {
                                    const selectedAnswerId = selectedAnswers[question.id];
                                    const selectedAnswer = question.answers.find(a => a.id === selectedAnswerId);
                                    const correctAnswer = question.answers.find(a => a.isCorrect);
                                    const isCorrect = selectedAnswerId === correctAnswer?.id;

                                    return (
                                        <div key={question.id} className="border rounded-lg p-4">
                                            <div className="flex items-start gap-3">
                                                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${isCorrect ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                                                    }`}>
                                                    {isCorrect ? "✓" : "✗"}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-medium mb-2">
                                                        {idx + 1}. {question.question}
                                                    </p>
                                                    <div className="text-sm text-gray-600">
                                                        <p>Your answer: {selectedAnswer?.answer || "Not answered"}</p>
                                                        {!isCorrect && (
                                                            <p className="text-green-600 mt-1">
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
        <div className="min-h-screen py-12 px-4 bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={handleBackToTopic}
                        className="text-blue-600 hover:text-blue-800 mb-4 inline-flex items-center gap-2"
                    >
                        ← Back to Topic
                    </button>
                    <div className="bg-white rounded-2xl shadow-xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h1 className="text-2xl font-bold">{topic.title}</h1>
                            <span className="text-sm text-gray-500">
                                Question {currentQuestionIndex + 1} of {topic.questions.length}
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${((currentQuestionIndex + 1) / topic.questions.length) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Question Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
                    <div className="mb-6">
                        <div className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 mb-4">
                            {currentQuestion.difficulty.toUpperCase()}
                        </div>
                        <h2 className="text-xl font-semibold">{currentQuestion.question}</h2>
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
                                            ? "border-blue-600 bg-blue-50"
                                            : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-blue-600 bg-blue-600" : "border-gray-400"
                                            }`}>
                                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                        </div>
                                        <span className="flex-1">{answer.answer}</span>
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
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                            }`}
                    >
                        Previous
                    </button>

                    {!isLastQuestion ? (
                        <button
                            onClick={handleNext}
                            disabled={!hasSelectedAnswer}
                            className={`px-6 py-3 rounded-xl font-medium transition-all ${hasSelectedAnswer
                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                }`}
                        >
                            Next Question
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={!allQuestionsAnswered}
                            className={`px-8 py-3 rounded-xl font-medium transition-all ${allQuestionsAnswered
                                    ? "bg-green-600 text-white hover:bg-green-700"
                                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                }`}
                        >
                            Submit Quiz
                        </button>
                    )}
                </div>

                {/* Progress Indicator */}
                <div className="mt-6 text-center text-sm text-gray-500">
                    {Object.keys(selectedAnswers).length} of {topic.questions.length} questions answered
                </div>
            </div>
        </div>
    );
}