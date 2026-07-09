import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspaceWithMember } from "@/lib/workspace";

// Called by the service worker's `pushsubscriptionchange` handler when the
// browser rotates a push subscription (key rotation, endpoint expiry). The SW
// may fire this while the app is closed and the Clerk cookie is stale, so the
// route is public: knowing the old endpoint (an unguessable capability URL
// that only this device and our DB ever saw) is proof enough to transfer the
// row. Without a known old endpoint we fall back to requiring a session.

export async function POST(req: NextRequest) {
  try {
    const { oldEndpoint, endpoint, keys, userAgent } = await req.json();

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const old = oldEndpoint
      ? await db.pushSubscription.findUnique({
          where: { endpoint: oldEndpoint },
          select: { id: true, memberId: true },
        })
      : null;

    let memberId = old?.memberId ?? null;
    if (!memberId) {
      try {
        const { member } = await requireWorkspaceWithMember();
        memberId = member.id;
      } catch {
        return NextResponse.json({ error: "Unknown subscription" }, { status: 401 });
      }
    }

    await db.$transaction([
      ...(old ? [db.pushSubscription.delete({ where: { id: old.id } })] : []),
      db.pushSubscription.upsert({
        where: { endpoint },
        create: {
          memberId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent: typeof userAgent === "string" ? userAgent.slice(0, 255) : null,
          lastSeenAt: new Date(),
        },
        update: {
          memberId,
          p256dh: keys.p256dh,
          auth: keys.auth,
          lastSeenAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to resubscribe" }, { status: 500 });
  }
}
