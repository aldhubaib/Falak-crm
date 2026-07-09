-- Hot-path indexes (performance overhaul, phase 2).
-- Notification: inbox unread rollup (GROUP BY linkUrl) and mark-thread-read
-- filter by (recipientId, read, linkUrl).
CREATE INDEX IF NOT EXISTS "Notification_recipientId_read_linkUrl_idx"
  ON "Notification"("recipientId", "read", "linkUrl");

-- Task: board query (live tasks per project by column).
CREATE INDEX IF NOT EXISTS "Task_projectId_deletedAt_statusId_idx"
  ON "Task"("projectId", "deletedAt", "statusId");

-- Task: publish queue (review/completed tasks with publishing enabled).
CREATE INDEX IF NOT EXISTS "Task_statusId_publish_deletedAt_idx"
  ON "Task"("statusId", "publish", "deletedAt");
