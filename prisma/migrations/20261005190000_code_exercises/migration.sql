-- "Try it yourself" exercises in coding lessons: code with blanks to fill in
CREATE TABLE "topic_exercises" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "blanks" TEXT NOT NULL,
    "explanation" TEXT,
    "language" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "topic_exercises_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "topic_exercises_topicId_idx" ON "topic_exercises"("topicId");
ALTER TABLE "topic_exercises" ADD CONSTRAINT "topic_exercises_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Quiz questions answered by typing into a blank ('blank') instead of picking an option ('mcq').
-- A blank question's answers are the accepted answers (all marked correct).
ALTER TABLE "questions" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'mcq';

-- What a student typed for a blank question
ALTER TABLE "question_attempts" ADD COLUMN "typedAnswer" TEXT;
ALTER TABLE "user_answers" ADD COLUMN "typedAnswer" TEXT;
