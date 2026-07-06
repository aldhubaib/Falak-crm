-- Publish-card visibility becomes a placement choice: hidden | expanded | always.
-- Fields that were shown (boolean true) map to "expanded" — the collapsed part
-- of the card stays reserved for project/date/title unless explicitly chosen.
ALTER TABLE "ChecklistTemplateItem" ADD COLUMN "publishCard" TEXT NOT NULL DEFAULT 'hidden';
UPDATE "ChecklistTemplateItem" SET "publishCard" = 'expanded' WHERE "showOnPublishCard" = true;
ALTER TABLE "ChecklistTemplateItem" DROP COLUMN "showOnPublishCard";

ALTER TABLE "TaskChecklistItem" ADD COLUMN "publishCard" TEXT NOT NULL DEFAULT 'hidden';
UPDATE "TaskChecklistItem" SET "publishCard" = 'expanded' WHERE "showOnPublishCard" = true;
ALTER TABLE "TaskChecklistItem" DROP COLUMN "showOnPublishCard";
