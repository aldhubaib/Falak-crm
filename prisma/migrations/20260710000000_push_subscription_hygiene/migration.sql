-- Push subscription hygiene: track the device (userAgent) and when it last
-- synced (lastSeenAt) so subscriptions unseen for 90+ days can be pruned.
ALTER TABLE "PushSubscription" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "PushSubscription" ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
