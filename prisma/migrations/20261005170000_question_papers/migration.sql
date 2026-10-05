-- Questions imported from a past exam or assignment paper (its name, e.g.
-- "MAT1503 Oct/Nov 2023 exam"). The mock exam asks these first.
ALTER TABLE "questions" ADD COLUMN "paper" TEXT;
CREATE INDEX "questions_paper_idx" ON "questions"("paper") WHERE "paper" IS NOT NULL;
