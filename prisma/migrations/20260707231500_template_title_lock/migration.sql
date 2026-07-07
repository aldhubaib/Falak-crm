-- Per-task-type lock rule for the built-in Title field.
ALTER TABLE "ChecklistTemplate" ADD COLUMN "titleLockedFromStageId" TEXT;
ALTER TABLE "ChecklistTemplate" ADD COLUMN "titleNeverLock" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_titleLockedFromStageId_fkey"
  FOREIGN KEY ("titleLockedFromStageId") REFERENCES "TaskStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
