-- Scripts module. workspaceId / projectId / taskId are intentionally plain
-- columns with no foreign keys into the CRM tables, so migrations on either
-- side stay independent.
CREATE TABLE "Script" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "targetMinutes" DOUBLE PRECISION,
    "dialect" TEXT NOT NULL DEFAULT 'kuwaiti',
    "tone" TEXT,
    "platform" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Script_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScriptSource" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "title" TEXT,
    "author" TEXT,
    "publishedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "trustLevel" INTEGER NOT NULL DEFAULT 2,
    "language" TEXT,
    "captionKind" TEXT,
    "rawText" TEXT,
    "cleanedText" TEXT,
    "segments" JSONB,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScriptSource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Script_workspaceId_deletedAt_idx" ON "Script"("workspaceId", "deletedAt");
CREATE INDEX "Script_projectId_idx" ON "Script"("projectId");
CREATE INDEX "ScriptSource_scriptId_order_idx" ON "ScriptSource"("scriptId", "order");

ALTER TABLE "ScriptSource" ADD CONSTRAINT "ScriptSource_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script"("id") ON DELETE CASCADE ON UPDATE CASCADE;
