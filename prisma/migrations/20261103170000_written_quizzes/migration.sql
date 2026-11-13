ALTER TABLE "questions" ADD COLUMN "maxMarks" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "questions" ADD COLUMN "writtenRubric" TEXT;
ALTER TABLE "questions" ADD COLUMN "modelAnswer" TEXT;
ALTER TABLE "question_attempts" ADD COLUMN "earnedMarks" DOUBLE PRECISION;
ALTER TABLE "question_attempts" ADD COLUMN "writtenFeedback" TEXT;
ALTER TABLE "questions" ADD CONSTRAINT "questions_positive_marks" CHECK ("maxMarks" > 0);
