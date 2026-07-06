-- Task-level publish control + per-field publish-card visibility.
ALTER TABLE "ChecklistTemplate" ADD COLUMN "publishToCalendar" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ChecklistTemplateItem" ADD COLUMN "showOnPublishCard" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TaskChecklistItem" ADD COLUMN "showOnPublishCard" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Task" ADD COLUMN "publish" BOOLEAN NOT NULL DEFAULT true;

-- Preserve current behavior: delivery fields were always shown on the publish
-- card, so backfill them to visible. Create-phase fields stay hidden (fixes
-- the duplicated Title row).
UPDATE "ChecklistTemplateItem" SET "showOnPublishCard" = true WHERE "phase" = 'delivery';
UPDATE "TaskChecklistItem" SET "showOnPublishCard" = true WHERE "phase" = 'delivery';
