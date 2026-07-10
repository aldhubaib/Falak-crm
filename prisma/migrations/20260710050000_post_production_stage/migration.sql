-- Insert "Post Production" before "AI Generation" (formerly "In Progress").

UPDATE "TaskStatus"
SET "order" = -"order"
WHERE "order" >= 2
  AND NOT EXISTS (
    SELECT 1 FROM "TaskStatus" pp
    WHERE pp."workspaceId" = "TaskStatus"."workspaceId"
      AND pp."name" = 'Post Production'
  );

UPDATE "TaskStatus"
SET "order" = (-"order") + 1
WHERE "order" < 0;

UPDATE "TaskStatus"
SET "name" = 'AI Generation'
WHERE "name" = 'In Progress';

INSERT INTO "TaskStatus" ("id", "workspaceId", "name", "order", "color")
SELECT
  'ts_post_production_' || w."id",
  w."id",
  'Post Production',
  2,
  '#8b5cf6'
FROM "Workspace" w
WHERE NOT EXISTS (
  SELECT 1 FROM "TaskStatus" pp
  WHERE pp."workspaceId" = w."id" AND pp."name" = 'Post Production'
);

-- Mirror each role's AI Generation permissions onto Post Production.
UPDATE "Role" r
SET "permissions" = jsonb_set(
  r."permissions"::jsonb,
  ARRAY['taskPermissions', 'stages', pp."id"],
  r."permissions"::jsonb #> ARRAY['taskPermissions', 'stages', ai."id"],
  true
)
FROM "TaskStatus" pp, "TaskStatus" ai
WHERE pp."workspaceId" = r."workspaceId"
  AND pp."name" = 'Post Production'
  AND ai."workspaceId" = r."workspaceId"
  AND ai."name" = 'AI Generation'
  AND r."permissions"::jsonb #> ARRAY['taskPermissions', 'stages', ai."id"] IS NOT NULL;
