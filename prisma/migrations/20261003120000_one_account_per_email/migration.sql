-- One account per email address, whatever the capitals.
--
-- The app already lowercases emails on sign-up and matches them
-- case-insensitively, but older accounts may still be stored as e.g.
-- "Guapo@Gmail.com", and the database itself only blocked exact duplicates.
--
-- 1. Lowercase (and trim) existing emails where that doesn't clash with
--    another account.
-- 2. Stop if two accounts share an email in different capitals, and name
--    them, so they can be merged or removed first (nothing is changed then).
-- 3. Require emails to be stored in lowercase. Together with the existing
--    unique index on "email", that makes every address belong to one account.

UPDATE "users" u
SET "email" = lower(btrim(u."email"))
WHERE u."email" <> lower(btrim(u."email"))
  AND NOT EXISTS (
    SELECT 1 FROM "users" o
    WHERE o."id" <> u."id" AND lower(btrim(o."email")) = lower(btrim(u."email"))
  );

DO $$
DECLARE
  duplicates text;
BEGIN
  SELECT string_agg(address, ', ') INTO duplicates
  FROM (
    SELECT lower(btrim("email")) AS address
    FROM "users"
    GROUP BY 1
    HAVING count(*) > 1
  ) d;

  IF duplicates IS NOT NULL THEN
    RAISE EXCEPTION 'More than one account uses these emails (ignoring capitals): %. Delete or merge the extra accounts in Admin > Users, then run the migration again.', duplicates;
  END IF;
END $$;

ALTER TABLE "users"
  ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = lower(btrim("email")));
