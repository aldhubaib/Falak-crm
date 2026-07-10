-- Planning recurrence fields on weekly targets (Lovable project settings).
ALTER TABLE "ProjectWeeklyTarget" ADD COLUMN "repeatEvery" TEXT NOT NULL DEFAULT 'week';
ALTER TABLE "ProjectWeeklyTarget" ADD COLUMN "startOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ProjectWeeklyTarget" ADD COLUMN "endsOn" TIMESTAMP(3);
ALTER TABLE "ProjectWeeklyTarget" ADD COLUMN "neverExpires" BOOLEAN NOT NULL DEFAULT true;
