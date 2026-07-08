-- Custom label + helper text for the built-in Title, per task type.
-- Rendering only: tasks keep storing Task.title.
ALTER TABLE "ChecklistTemplate" ADD COLUMN "titleLabel" TEXT;
ALTER TABLE "ChecklistTemplate" ADD COLUMN "titleHelp" TEXT;
