-- Coding modules: NULL = decided from the module code (COS/INF/ICT are coding
-- modules, in C++), 'none' = not a coding module, otherwise the language.
ALTER TABLE "modules" ADD COLUMN "codingLanguage" TEXT;

-- Coding projects: a topic's hands-on programming tasks, marked by AI
CREATE TABLE "coding_projects" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "starterCode" TEXT,
    "rubric" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coding_projects_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "coding_projects_topicId_idx" ON "coding_projects"("topicId");
ALTER TABLE "coding_projects" ADD CONSTRAINT "coding_projects_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A student's uploaded files for a project and the AI's marking
CREATE TABLE "project_submissions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "files" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "feedback" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_submissions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_submissions_projectId_userId_idx" ON "project_submissions"("projectId", "userId");
ALTER TABLE "project_submissions" ADD CONSTRAINT "project_submissions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "coding_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_submissions" ADD CONSTRAINT "project_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
