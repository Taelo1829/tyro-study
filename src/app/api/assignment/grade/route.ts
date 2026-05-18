import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from "@/lib/auth"
import { prisma } from '@/lib/prisma'
import { getOpenAIClient } from "@/lib/ai/openai"
import { getServerSession } from 'next-auth'

interface GradeResult {
    percentage: number
    passed: boolean
    summary: string
    notes: { type: 'correct' | 'improvement' | 'error'; text: string }[]
    suggestions: string[]
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { topicId, code, filename } = body as {
        topicId: string
        code: string
        filename?: string
    }

    if (!topicId || !code?.trim()) {
        return NextResponse.json({ error: 'topicId and code are required' }, { status: 400 })
    }

    if (code.length > 50_000) {
        return NextResponse.json({ error: 'File too large (max 50 000 characters)' }, { status: 400 })
    }

    // Fetch the assignment brief from the topic
    const topic = await prisma.topic.findUnique({
        where: { id: topicId },
        select: { title: true, assignment: true },
    })

    if (!topic) {
        return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    if (!topic.assignment?.trim()) {
        return NextResponse.json({ error: 'This topic has no assignment defined' }, { status: 400 })
    }

    // Strip HTML tags from the assignment for the prompt
    const assignmentText = topic.assignment
        .replace(/<[^>]*>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s{2,}/g, ' ')
        .trim()

    const systemPrompt = `You are an expert C++ programming instructor grading a student's assignment submission.
Your job is to:
1. Read the assignment requirements carefully
2. Review the student's code
3. Grade the submission objectively
4. Provide constructive, specific feedback

You MUST respond with ONLY a valid JSON object, no markdown, no explanation outside the JSON.

The JSON must have this exact shape:
{
  "percentage": <integer 0-100>,
  "passed": <boolean, true if percentage >= 60>,
  "summary": "<1-2 sentence overall assessment>",
  "notes": [
    { "type": "correct",     "text": "<something done well>" },
    { "type": "improvement", "text": "<something that could be better>" },
    { "type": "error",       "text": "<a mistake or bug>" }
  ],
  "suggestions": [
    "<actionable suggestion 1>",
    "<actionable suggestion 2>"
  ]
}

Rules:
- "notes" should have 2-6 items total, mixing types as appropriate
- "suggestions" should have 1-4 items, only if there are improvements to be made
- Be specific: reference actual variable names, functions, or line behaviours from the code
- If the code is incomplete or doesn't compile, reflect that in the percentage
- If the code fully satisfies the requirements, percentage should be 85-100`

    const userPrompt = `## Assignment: ${topic.title}

${assignmentText}

---

## Student Submission (${filename ?? 'submission.cpp'})

\`\`\`cpp
${code}
\`\`\`

Grade this submission.`

    try {
        const openai = getOpenAIClient()
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.2,
            max_tokens: 1000,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
        })

        const raw = response.choices[0].message.content ?? '{}'
        const cleaned = raw.replace(/```json|```/g, '').trim()
        const result: GradeResult = JSON.parse(cleaned)

        result.percentage = Math.max(0, Math.min(100, Math.round(result.percentage)))
        result.passed = result.percentage >= 60

        await prisma.assignment_Attempt.create({
            data: {
                topicId,
                userId: session.user.id,
                percentage: result.percentage,
                passed: result.passed,
            },
        })

        return NextResponse.json(result)
    } catch (err: any) {
        console.error('Assignment grading error:', err)
        return NextResponse.json(
            { error: 'Grading failed. Please try again.' },
            { status: 500 }
        )
    }
}