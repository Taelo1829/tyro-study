-- Keep the question reference and text snapshot even if content is regenerated.
ALTER TABLE "feedback" ADD COLUMN "questionId" TEXT;
CREATE UNIQUE INDEX "feedback_open_question_flag" ON "feedback" ("userId", "questionId")
WHERE "questionId" IS NOT NULL AND "status" IN ('new', 'planned');
