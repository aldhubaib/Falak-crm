-- Push tag per notification so read/clear can close it on other devices.
ALTER TABLE "Notification" ADD COLUMN "tag" TEXT;
