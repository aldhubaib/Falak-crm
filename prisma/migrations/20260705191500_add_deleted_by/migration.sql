-- Record who moved each record to the trash
ALTER TABLE "Company" ADD COLUMN "deletedBy" TEXT;
ALTER TABLE "Contact" ADD COLUMN "deletedBy" TEXT;
ALTER TABLE "Deal" ADD COLUMN "deletedBy" TEXT;
ALTER TABLE "Project" ADD COLUMN "deletedBy" TEXT;
ALTER TABLE "Task" ADD COLUMN "deletedBy" TEXT;
ALTER TABLE "ProjectFolder" ADD COLUMN "deletedBy" TEXT;
ALTER TABLE "ProjectAsset" ADD COLUMN "deletedBy" TEXT;
