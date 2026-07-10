-- Weekly plan auto-assign: slot responsibility + per-template toggle.
ALTER TABLE "ProjectWeeklyTarget" ADD COLUMN "autoAssign" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "WeeklySlot" ADD COLUMN "assigneeId" TEXT;

CREATE INDEX "WeeklySlot_assigneeId_weekStart_idx" ON "WeeklySlot"("assigneeId", "weekStart");

ALTER TABLE "WeeklySlot" ADD CONSTRAINT "WeeklySlot_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "WorkspaceMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
