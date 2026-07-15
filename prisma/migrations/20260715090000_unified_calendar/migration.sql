-- Unified calendar: one Sunday-anchored week grid for the whole workspace,
-- weekly-only plans, and Thursday 23:59 (Asia/Kuwait) due dates.

-- Plans are weekly-only now — drop the recurrence machinery.
ALTER TABLE "ProjectWeeklyTarget" DROP COLUMN "repeatEvery";
ALTER TABLE "ProjectWeeklyTarget" DROP COLUMN "startOn";
ALTER TABLE "ProjectWeeklyTarget" DROP COLUMN "endsOn";
ALTER TABLE "ProjectWeeklyTarget" DROP COLUMN "neverExpires";

-- One workspace-wide timezone (Asia/Kuwait) — the per-project setting is gone.
ALTER TABLE "Project" DROP COLUMN "timezone";

-- Snap every weekStart onto the unified grid: Sunday 00:00 Kuwait of the week
-- the old anchor falls in (old rows were Monday-anchored, some with sub-minute
-- drift from the old timezone math). postgres date_trunc('week') anchors on
-- Monday, so shift by a day to anchor on Sunday. Idempotent.
UPDATE "WeeklySlot"
SET "weekStart" = (
  (
    date_trunc(
      'week',
      (("weekStart" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kuwait') + INTERVAL '1 day'
    ) - INTERVAL '1 day'
  ) AT TIME ZONE 'Asia/Kuwait'
) AT TIME ZONE 'UTC';

-- Re-stamp due dates of open planned work onto the unified grid: Thursday
-- 23:59 Kuwait of the slot's week. weekStart is Sunday 00:00 Kuwait stored as
-- UTC, so Thursday 23:59 = weekStart + 4 days 23h59m. Force-added slots keep
-- their explicit deadline.
UPDATE "Task" t
SET "dueDate" = COALESCE(
  s."dueDate",
  s."weekStart" + INTERVAL '4 days 23 hours 59 minutes'
)
FROM "WeeklySlot" s
WHERE s."taskId" = t."id"
  AND t."completedAt" IS NULL
  AND t."deletedAt" IS NULL;
