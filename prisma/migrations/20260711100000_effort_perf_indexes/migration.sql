-- Performance + integrity hardening for the effort feature.

-- 1. Dedupe any checklist rows created twice for the same template field
--    (possible before the unique constraint existed, e.g. two concurrent
--    getTask materialisations). Keep the row with the most data: completed
--    first, then one holding an attachment or text, then the oldest id.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "taskId", "templateItemId"
      ORDER BY
        "completed" DESC,
        ("attachmentId" IS NOT NULL) DESC,
        ("textValue" IS NOT NULL) DESC,
        "id" ASC
    ) AS rn
  FROM "TaskChecklistItem"
  WHERE "templateItemId" IS NOT NULL
)
DELETE FROM "TaskChecklistItem"
WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1);

-- 2. One row per template field per task. NULL templateItemId (custom rows)
--    is exempt — Postgres unique indexes ignore NULLs.
CREATE UNIQUE INDEX "TaskChecklistItem_taskId_templateItemId_key"
  ON "TaskChecklistItem"("taskId", "templateItemId");

-- 3. Title-wide effort recalculation filters on completedBy + effortLockedAt.
CREATE INDEX "TaskChecklistItem_completedBy_effortLockedAt_idx"
  ON "TaskChecklistItem"("completedBy", "effortLockedAt");

-- 4. Template-item joins (field config precedence, materialisation checks).
CREATE INDEX "TaskChecklistItem_templateItemId_idx"
  ON "TaskChecklistItem"("templateItemId");

-- 5. Effort/duration lookups fetch attachments by entity without workspaceId,
--    which the existing (workspaceId, entityType, entityId) index can't serve.
CREATE INDEX "Attachment_entityType_entityId_status_idx"
  ON "Attachment"("entityType", "entityId", "status");
