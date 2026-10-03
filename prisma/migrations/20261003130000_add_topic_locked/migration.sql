-- Admins can lock a topic: students must pass the previous topic's quiz to open it
ALTER TABLE "topics" ADD COLUMN "locked" BOOLEAN NOT NULL DEFAULT false;
