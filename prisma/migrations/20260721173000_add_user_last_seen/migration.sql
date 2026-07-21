-- Preserve existing users while making last-seen tracking mandatory for new users.
ALTER TABLE "users"
ADD COLUMN "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
