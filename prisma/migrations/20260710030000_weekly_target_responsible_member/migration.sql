-- Replace boolean autoAssign with a specific responsible project member.
ALTER TABLE "ProjectWeeklyTarget" ADD COLUMN "responsibleMemberId" TEXT;

ALTER TABLE "ProjectWeeklyTarget" ADD CONSTRAINT "ProjectWeeklyTarget_responsibleMemberId_fkey" FOREIGN KEY ("responsibleMemberId") REFERENCES "WorkspaceMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectWeeklyTarget" DROP COLUMN "autoAssign";
