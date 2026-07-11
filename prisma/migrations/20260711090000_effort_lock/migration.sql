-- Lock effort per checklist field when work is done. Rates only change when
-- the owner explicitly hits Recalculate on a completed task.
ALTER TABLE "TaskChecklistItem" ADD COLUMN "effortQuantity" DOUBLE PRECISION;
ALTER TABLE "TaskChecklistItem" ADD COLUMN "effortRate" DOUBLE PRECISION;
ALTER TABLE "TaskChecklistItem" ADD COLUMN "effortMinutes" DOUBLE PRECISION;
ALTER TABLE "TaskChecklistItem" ADD COLUMN "effortLockedAt" TIMESTAMP(3);
