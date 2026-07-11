-- Task type stored directly on the task. Until now the type was inferred from
-- the checklist items' template links, which breaks for templates with zero
-- fields (no items -> no link -> "task has no type").
ALTER TABLE "Task" ADD COLUMN "templateId" TEXT;

ALTER TABLE "Task" ADD CONSTRAINT "Task_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Task_projectId_templateId_idx" ON "Task"("projectId", "templateId");

-- Backfill existing tasks from their checklist items' template links.
UPDATE "Task" t
SET "templateId" = sub."templateId"
FROM (
  SELECT ci."taskId", MAX(ti."templateId") AS "templateId"
  FROM "TaskChecklistItem" ci
  JOIN "ChecklistTemplateItem" ti ON ti."id" = ci."templateItemId"
  GROUP BY ci."taskId"
) sub
WHERE sub."taskId" = t."id"
  AND t."templateId" IS NULL;
