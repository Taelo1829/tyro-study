-- AI study note for a question, written the first time any student gets it
-- wrong and reused for everyone after that (it's also added to the topic's lesson).
ALTER TABLE "questions" ADD COLUMN "studyNote" TEXT;
-- Set while one request is writing the note, so two students failing the
-- same question at once don't both trigger the AI
ALTER TABLE "questions" ADD COLUMN "studyNoteClaimedAt" TIMESTAMP(3);
