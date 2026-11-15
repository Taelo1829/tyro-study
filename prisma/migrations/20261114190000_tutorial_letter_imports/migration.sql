CREATE TABLE "tutorial_letter_imports" (
  "id" TEXT PRIMARY KEY,
  "moduleId" TEXT NOT NULL REFERENCES "modules"("id") ON DELETE CASCADE,
  "data" TEXT NOT NULL,
  "applied" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "tutorial_letter_imports_moduleId_createdAt_idx" ON "tutorial_letter_imports"("moduleId", "createdAt");
