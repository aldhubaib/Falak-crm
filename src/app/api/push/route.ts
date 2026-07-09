import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspaceWithMember } from "@/lib/workspace";

// Devices refresh their subscription (and lastSeenAt) via this route on every
// session. Subscriptions that haven't checked in for 90+ days belong to
// devices that are gone (browser reinstalled, permission revoked offline) —
// prune them here so push fan-out stops paying for dead endpoints.
const PRUNE_AFTER_DAYS = 90;

export async function POST(req: NextRequest) {
  try {
    const { member } = await requireWorkspaceWithMember();
    const { endpoint, keys } = await req.json();

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const userAgent = req.headers.get("user-agent")?.slice(0, 255) ?? null;

    await db.pushSubscription.upsert({
      where: { endpoint },
      create: {
        memberId: member.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
        lastSeenAt: new Date(),
      },
      update: {
        memberId: member.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
        lastSeenAt: new Date(),
      },
    });

    // Opportunistic hygiene, off the response path.
    const cutoff = new Date(Date.now() - PRUNE_AFTER_DAYS * 24 * 60 * 60 * 1000);
    void db.pushSubscription
      .deleteMany({ where: { memberId: member.id, lastSeenAt: { lt: cutoff } } })
      .catch(() => {});

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { member } = await requireWorkspaceWithMember();
    const { endpoint } = await req.json();

    if (endpoint) {
      await db.pushSubscription.deleteMany({ where: { endpoint, memberId: member.id } });
    } else {
      await db.pushSubscription.deleteMany({ where: { memberId: member.id } });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to remove subscription" }, { status: 500 });
  }
}
