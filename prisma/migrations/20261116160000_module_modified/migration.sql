ALTER TABLE "modules" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "modules" SET "updatedAt" = "createdAt";
ALTER TABLE "modules" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "modules" ALTER COLUMN "updatedAt" SET NOT NULL;
CREATE INDEX "modules_updatedAt_idx" ON "modules" ("updatedAt");

CREATE FUNCTION stamp_module_modified() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" = clock_timestamp();
  RETURN NEW;
END;
$$;
CREATE TRIGGER modules_modified BEFORE UPDATE ON "modules"
FOR EACH ROW EXECUTE FUNCTION stamp_module_modified();

-- Include raw SQL imports, moves and deletions, but not student activity.
CREATE FUNCTION touch_content_module() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  item jsonb;
  previous jsonb;
  current_row jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN previous = to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN current_row = to_jsonb(NEW); END IF;
  IF TG_TABLE_NAME = 'questions' AND TG_OP = 'UPDATE' AND
    (previous - 'studyNote' - 'studyNoteClaimedAt') = (current_row - 'studyNote' - 'studyNoteClaimedAt') THEN
    RETURN NULL;
  END IF;
  FOR item IN SELECT DISTINCT value FROM jsonb_array_elements(jsonb_build_array(previous, current_row)) WHERE value <> 'null'::jsonb LOOP
    IF TG_TABLE_NAME IN ('chapters', 'course_modules') THEN
      UPDATE "modules" SET "updatedAt" = clock_timestamp() WHERE "id" = item->>'moduleId';
    ELSIF TG_TABLE_NAME = 'topics' THEN
      UPDATE "modules" SET "updatedAt" = clock_timestamp() WHERE "id" IN
        (SELECT "moduleId" FROM "chapters" WHERE "id" = item->>'chapterId');
    ELSIF TG_TABLE_NAME = 'questions' THEN
      UPDATE "modules" SET "updatedAt" = clock_timestamp() WHERE "id" IN
        (SELECT c."moduleId" FROM "chapters" c LEFT JOIN "topics" t ON t."chapterId" = c."id"
         WHERE c."id" = item->>'chapterId' OR t."id" = item->>'topicId');
    ELSIF TG_TABLE_NAME = 'answers' THEN
      UPDATE "modules" SET "updatedAt" = clock_timestamp() WHERE "id" IN
        (SELECT c."moduleId" FROM "questions" q LEFT JOIN "topics" t ON t."id" = q."topicId"
         JOIN "chapters" c ON c."id" = q."chapterId" OR c."id" = t."chapterId"
         WHERE q."id" = item->>'questionId');
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
CREATE TRIGGER chapters_module_modified AFTER INSERT OR UPDATE OR DELETE ON "chapters" FOR EACH ROW EXECUTE FUNCTION touch_content_module();
CREATE TRIGGER topics_module_modified AFTER INSERT OR UPDATE OR DELETE ON "topics" FOR EACH ROW EXECUTE FUNCTION touch_content_module();
CREATE TRIGGER questions_module_modified AFTER INSERT OR UPDATE OR DELETE ON "questions" FOR EACH ROW EXECUTE FUNCTION touch_content_module();
CREATE TRIGGER answers_module_modified AFTER INSERT OR UPDATE OR DELETE ON "answers" FOR EACH ROW EXECUTE FUNCTION touch_content_module();
CREATE TRIGGER courses_module_modified AFTER INSERT OR UPDATE OR DELETE ON "course_modules" FOR EACH ROW EXECUTE FUNCTION touch_content_module();
