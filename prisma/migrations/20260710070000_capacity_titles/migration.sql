-- Capacity planning: Titles carry effort rates (minutes per unit of content),
-- members get a title + weekly hours, checklist fields declare an effort unit,
-- tasks get a planned video length, attachments store media duration.

CREATE TABLE "Title" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Title_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Title_workspaceId_name_key" ON "Title"("workspaceId", "name");

ALTER TABLE "Title" ADD CONSTRAINT "Title_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TitleFieldRate" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "templateItemId" TEXT NOT NULL,
    "minutesPerUnit" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TitleFieldRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TitleFieldRate_titleId_templateItemId_key" ON "TitleFieldRate"("titleId", "templateItemId");

ALTER TABLE "TitleFieldRate" ADD CONSTRAINT "TitleFieldRate_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TitleFieldRate" ADD CONSTRAINT "TitleFieldRate_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "ChecklistTemplateItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TitleStageRate" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "minutesPerPass" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TitleStageRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TitleStageRate_titleId_statusId_key" ON "TitleStageRate"("titleId", "statusId");

ALTER TABLE "TitleStageRate" ADD CONSTRAINT "TitleStageRate_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TitleStageRate" ADD CONSTRAINT "TitleStageRate_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "TaskStatus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMember" ADD COLUMN "titleId" TEXT;
ALTER TABLE "WorkspaceMember" ADD COLUMN "weeklyHours" DOUBLE PRECISION NOT NULL DEFAULT 40;
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChecklistTemplateItem" ADD COLUMN "effortUnit" TEXT;
ALTER TABLE "ChecklistTemplateItem" ADD COLUMN "qtyPerVideoMinute" DOUBLE PRECISION;

ALTER TABLE "TaskChecklistItem" ADD COLUMN "effortUnit" TEXT;
ALTER TABLE "TaskChecklistItem" ADD COLUMN "qtyPerVideoMinute" DOUBLE PRECISION;

ALTER TABLE "Task" ADD COLUMN "plannedMinutes" DOUBLE PRECISION;

ALTER TABLE "Attachment" ADD COLUMN "durationSec" DOUBLE PRECISION;
