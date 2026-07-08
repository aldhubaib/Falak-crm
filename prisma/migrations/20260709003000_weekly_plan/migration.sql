-- Weekly Plan: per-project weekly capacity per task type, and the Todo slots
-- it produces each week.

CREATE TABLE "ProjectWeeklyTarget" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "perWeek" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectWeeklyTarget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectWeeklyTarget_projectId_templateId_key" ON "ProjectWeeklyTarget"("projectId", "templateId");

ALTER TABLE "ProjectWeeklyTarget" ADD CONSTRAINT "ProjectWeeklyTarget_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectWeeklyTarget" ADD CONSTRAINT "ProjectWeeklyTarget_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WeeklySlot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "taskId" TEXT,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklySlot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeeklySlot_taskId_key" ON "WeeklySlot"("taskId");
CREATE INDEX "WeeklySlot_projectId_weekStart_idx" ON "WeeklySlot"("projectId", "weekStart");

ALTER TABLE "WeeklySlot" ADD CONSTRAINT "WeeklySlot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklySlot" ADD CONSTRAINT "WeeklySlot_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklySlot" ADD CONSTRAINT "WeeklySlot_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
