-- Add "Never" option for checklist field locking: when set, the field stays
-- editable at every stage regardless of the Auto rule or a Locked From stage.
ALTER TABLE "ChecklistTemplateItem" ADD COLUMN "neverLock" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TaskChecklistItem" ADD COLUMN "neverLock" BOOLEAN NOT NULL DEFAULT false;
