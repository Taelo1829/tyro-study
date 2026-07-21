ALTER TABLE "questions" ALTER COLUMN "topicId" DROP NOT NULL;
ALTER TABLE "questions" ADD COLUMN "chapterId" TEXT;
ALTER TABLE "questions" ADD CONSTRAINT "questions_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "questions_chapterId_idx" ON "questions"("chapterId");
