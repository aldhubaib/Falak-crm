-- Soft delete support for project media (assets + folders) so deletions go to Trash
ALTER TABLE "ProjectFolder" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "ProjectAsset" ADD COLUMN "deletedAt" TIMESTAMP(3);
