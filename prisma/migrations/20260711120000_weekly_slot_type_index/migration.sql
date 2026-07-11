-- Todo gate: the slot claim looks up free slots and counts rows by
-- (projectId, templateId, weekStart) on every drag into Todo.
CREATE INDEX "WeeklySlot_projectId_templateId_weekStart_idx"
  ON "WeeklySlot"("projectId", "templateId", "weekStart");
