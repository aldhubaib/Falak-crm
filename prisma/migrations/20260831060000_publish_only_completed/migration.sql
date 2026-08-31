-- The publish queue used to accept any task whose status name contained
-- "review" or "completed", so mid-pipeline stages ("Raw Footage Review",
-- "Review") could be booked onto the calendar. Those slots are no longer
-- reachable and would resurface with a stale date once the task finished, so
-- drop them here.
--
-- Only unpublished slots are removed. A published row is a record of something
-- that actually went out, regardless of where the task sits now.
DELETE FROM "PublishItem"
WHERE published = false
  AND "taskId" IN (
    SELECT t."id"
    FROM "Task" t
    LEFT JOIN "TaskStatus" s ON s."id" = t."statusId"
    WHERE s."name" IS NULL
       OR s."name" NOT IN ('Completed', 'Published')
  );
