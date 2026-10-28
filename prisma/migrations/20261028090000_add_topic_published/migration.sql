-- Admins choose which lessons are public study notes (readable without signing in,
-- in the sitemap, eligible for ads). Everything starts unpublished.
ALTER TABLE "topics" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false;
