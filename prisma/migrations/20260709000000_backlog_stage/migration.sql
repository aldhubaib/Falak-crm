-- Add a "Backlog" stage as the new first Kanban column for every workspace.
-- Tasks are created here from now on; Todo becomes the second stage.

INSERT INTO "TaskStatus" ("id", "workspaceId", "name", "order", "color")
SELECT
  'ts_backlog_' || w."id",
  w."id",
  'Backlog',
  COALESCE((SELECT MIN(ts."order") - 1 FROM "TaskStatus" ts WHERE ts."workspaceId" = w."id"), 0),
  '#64748b'
FROM "Workspace" w
WHERE NOT EXISTS (
  SELECT 1 FROM "TaskStatus" b
  WHERE b."workspaceId" = w."id" AND b."name" = 'Backlog'
);

-- Mirror each role's Todo stage permissions onto the new Backlog stage so
-- existing roles keep working (members who could create/move tasks in Todo
-- can do the same in Backlog). Admins can fine-tune in Settings -> Roles.
UPDATE "Role" r
SET "permissions" = jsonb_set(
  r."permissions"::jsonb,
  ARRAY['taskPermissions', 'stages', b."id"],
  r."permissions"::jsonb #> ARRAY['taskPermissions', 'stages', t."id"],
  true
)
FROM "TaskStatus" b, "TaskStatus" t
WHERE b."workspaceId" = r."workspaceId" AND b."name" = 'Backlog'
  AND t."workspaceId" = r."workspaceId" AND t."name" = 'Todo'
  AND r."permissions"::jsonb #> ARRAY['taskPermissions', 'stages', t."id"] IS NOT NULL;
