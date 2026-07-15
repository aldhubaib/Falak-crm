-- Per-plan start week: a plan can begin this week or defer to next week so
-- the team has time to stock the backlog first.
ALTER TABLE "ProjectWeeklyTarget"
  ADD COLUMN "startsOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Every existing plan is already running — anchor it firmly in the past.
UPDATE "ProjectWeeklyTarget" SET "startsOn" = TIMESTAMP '2020-01-05 00:00:00';
