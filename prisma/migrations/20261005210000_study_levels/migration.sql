-- Study levels: 'tertiary' (university/college modules) or 'highschool' (Grade 11 and 12 subjects).
-- Students pick theirs when they sign up (and can change it on their profile);
-- they see the modules or subjects of their level.
ALTER TABLE "users" ADD COLUMN "level" TEXT NOT NULL DEFAULT 'tertiary';
ALTER TABLE "modules" ADD COLUMN "level" TEXT NOT NULL DEFAULT 'tertiary';
ALTER TABLE "courses" ADD COLUMN "level" TEXT NOT NULL DEFAULT 'tertiary';

-- High school subjects are grouped by grade
INSERT INTO "courses" ("id", "title", "description", "level")
SELECT 'grade-11', 'Grade 11', 'Grade 11 subjects (CAPS)', 'highschool'
WHERE NOT EXISTS (SELECT 1 FROM "courses" WHERE "id" = 'grade-11');
INSERT INTO "courses" ("id", "title", "description", "level")
SELECT 'grade-12', 'Grade 12', 'Grade 12 (matric) subjects (CAPS)', 'highschool'
WHERE NOT EXISTS (SELECT 1 FROM "courses" WHERE "id" = 'grade-12');
