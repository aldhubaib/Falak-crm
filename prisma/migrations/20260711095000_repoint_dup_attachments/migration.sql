-- Runs immediately BEFORE the duplicate-checklist-row cleanup in
-- 20260711100000_effort_perf_indexes. Multi-file uploads reference their
-- checklist row through Attachment.entityId (no FK), so deleting a duplicate
-- row would orphan its files. Re-point every attachment that hangs off a
-- soon-to-be-deleted duplicate onto the surviving row first.
--
-- Survivor ranking matches the dedup migration exactly: completed first,
-- then a row holding an attachment or text, then the oldest id.
WITH ranked AS (
  SELECT
    "id",
    "taskId",
    "templateItemId",
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
),
losers AS (
  SELECT
    r."id" AS loser_id,
    s."id" AS survivor_id
  FROM ranked r
  JOIN ranked s
    ON s."taskId" = r."taskId"
   AND s."templateItemId" = r."templateItemId"
   AND s.rn = 1
  WHERE r.rn > 1
)
UPDATE "Attachment" a
SET "entityId" = l.survivor_id
FROM losers l
WHERE a."entityType" = 'checklist_item'
  AND a."entityId" = l.loser_id;
