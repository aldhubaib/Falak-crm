-- The "Expected Words per Video Minute" prediction ratio was removed from the
-- product: word-count fields are simply unpredictable until the text exists.
ALTER TABLE "ChecklistTemplateItem" DROP COLUMN IF EXISTS "qtyPerVideoMinute";
ALTER TABLE "TaskChecklistItem" DROP COLUMN IF EXISTS "qtyPerVideoMinute";
