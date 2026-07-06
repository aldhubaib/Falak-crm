-- Template fields that already hold data on tasks can't be hard-deleted;
-- instead they can be disabled ("hidden"): kept in the database with their
-- task answers, but no longer shown on tasks or enforced by stage gates.
ALTER TABLE "ChecklistTemplateItem" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TaskChecklistItem" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
