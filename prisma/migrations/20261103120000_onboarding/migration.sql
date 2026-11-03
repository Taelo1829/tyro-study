-- Existing accounts keep their current experience; new accounts start at step 0.
ALTER TABLE "users" ADD COLUMN "onboardingStep" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "users" ALTER COLUMN "onboardingStep" SET DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "dailyGoal" INTEGER;
ALTER TABLE "users" ADD CONSTRAINT "users_onboarding_step_check" CHECK ("onboardingStep" BETWEEN 0 AND 3);
ALTER TABLE "users" ADD CONSTRAINT "users_daily_goal_check" CHECK ("dailyGoal" IN (5, 10, 20));
