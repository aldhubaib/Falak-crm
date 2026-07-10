-- Post Production belongs after AI Generation, not before it.

UPDATE "TaskStatus" AS pp
SET "order" = -1
WHERE pp."name" = 'Post Production'
  AND EXISTS (
    SELECT 1 FROM "TaskStatus" ai
    WHERE ai."workspaceId" = pp."workspaceId"
      AND ai."name" = 'AI Generation'
      AND pp."order" < ai."order"
  );

UPDATE "TaskStatus"
SET "order" = 2
WHERE "name" = 'AI Generation'
  AND "order" = 3;

UPDATE "TaskStatus"
SET "order" = 3
WHERE "name" = 'Post Production'
  AND "order" = -1;
