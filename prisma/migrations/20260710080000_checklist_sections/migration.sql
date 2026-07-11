-- Editable checklist sections: task-type fields group into named sections
-- (rename / add / remove) instead of the two hardcoded "Requirements" /
-- "Delivery" groups. Each section keeps a phase ("create" | "delivery") that
-- drives the existing behavior (creation form, locking, review gates).

CREATE TABLE "ChecklistSection" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'delivery',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistSection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChecklistSection_templateId_idx" ON "ChecklistSection"("templateId");

ALTER TABLE "ChecklistSection" ADD CONSTRAINT "ChecklistSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChecklistTemplateItem" ADD COLUMN "sectionId" TEXT;
ALTER TABLE "ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ChecklistSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every existing template gets the two classic sections, and its
-- items link to them by phase.
INSERT INTO "ChecklistSection" ("id", "templateId", "name", "phase", "order")
SELECT 'sec_' || md5(random()::text || t."id" || 'create'), t."id", 'Requirements', 'create', 0
FROM "ChecklistTemplate" t;

INSERT INTO "ChecklistSection" ("id", "templateId", "name", "phase", "order")
SELECT 'sec_' || md5(random()::text || t."id" || 'delivery'), t."id", 'Delivery', 'delivery', 1
FROM "ChecklistTemplate" t;

UPDATE "ChecklistTemplateItem" i
SET "sectionId" = s."id"
FROM "ChecklistSection" s
WHERE s."templateId" = i."templateId"
  AND s."phase" = CASE WHEN i."phase" = 'delivery' THEN 'delivery' ELSE 'create' END;
