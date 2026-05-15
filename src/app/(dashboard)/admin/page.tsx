import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, FileText, Layers, ListTree } from "lucide-react"
import { prisma } from "@/lib/prisma"

export default async function AdminPage() {
  const [moduleCount, chapterCount, topicCount, questionCount] =
    await Promise.all([
      prisma.module.count(),
      prisma.chapter.count(),
      prisma.topic.count(),
      prisma.question.count(),
    ])

  const links = [
    {
      href: "/admin/modules",
      label: "Modules",
      description: "Create and manage course modules",
      icon: BookOpen,
      count: moduleCount,
    },
    {
      href: "/admin/modules",
      label: "Content hierarchy",
      description: "Module → Chapter → Topic workflow",
      icon: ListTree,
      count: chapterCount,
    },
    {
      href: "/admin/modules",
      label: "Topics & PDFs",
      description: "Upload PDFs and extract quiz questions",
      icon: FileText,
      count: topicCount,
    },
    {
      href: "/admin/modules",
      label: "Questions",
      description: `${questionCount} questions in database`,
      icon: Layers,
      count: questionCount,
    },
  ]

  return (
    <>
      <Header
        title="Admin"
        subtitle="Manage content hierarchy and AI extraction"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.label} href={item.href}>
              <Card className="h-full transition-transform hover:scale-[1.02]">
                <CardHeader className="pb-2">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full neo-pressed">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{item.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-primary">
                    {item.count}
                  </p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <Card>
        <CardContent className="py-6">
          <p className="mb-4 text-sm text-muted-foreground">
            Workflow: create a <strong>Module</strong> → add{" "}
            <strong>Chapters</strong> → add <strong>Topics</strong> with content
            → upload a <strong>PDF</strong> to extract questions with AI.
          </p>
          <Link
            href="/admin/modules"
            className="text-sm font-medium text-primary hover:underline"
          >
            Go to modules →
          </Link>
        </CardContent>
      </Card>
    </>
  )
}
