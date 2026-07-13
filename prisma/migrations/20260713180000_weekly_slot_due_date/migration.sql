-- Explicit deadline on a weekly slot (set by owner force-add); tasks claiming
-- the slot adopt it instead of the plan cycle's end.
ALTER TABLE "WeeklySlot" ADD COLUMN "dueDate" TIMESTAMP(3);
