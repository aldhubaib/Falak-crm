-- Weekly plan cadence: slots are produced every N weeks (1 = weekly,
-- 2 = biweekly…), counted from the plan's start week.
ALTER TABLE "ProjectWeeklyTarget" ADD COLUMN "intervalWeeks" INTEGER NOT NULL DEFAULT 1;
