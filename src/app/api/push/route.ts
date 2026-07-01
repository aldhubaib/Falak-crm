import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspaceWithMember } from "@/lib/workspace";

export async function POST(req: NextRequest) {
  try {
    const { member } = await requireWorkspaceWithMember();
    const { endpoint, keys } = await req.json();

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    await db.pushSubscription.upsert({
      where: { endpoint },
      create: {
        memberId: member.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      update: {
        memberId: member.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

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
