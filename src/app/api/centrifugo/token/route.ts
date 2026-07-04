import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspaceWithMember, getProjectAccess } from "@/lib/workspace";
import {
  connectionToken,
  subscriptionToken,
  isCentrifugoConfigured,
} from "@/lib/centrifugo";

export const runtime = "nodejs";

// Mints Centrifugo JWTs for the signed-in member.
//   POST {}                       -> connection token
//   POST { channel: "task:123" }  -> subscription token (after access check)
export async function POST(request: NextRequest) {
  if (!isCentrifugoConfigured()) {
    return NextResponse.json({ error: "Realtime disabled" }, { status: 503 });
  }

  let workspaceId: string;
  let memberId: string;
  try {
    const { workspace, member } = await requireWorkspaceWithMember();
    workspaceId = workspace.id;
    memberId = member.id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { channel?: string };
  const channel = body.channel;

  if (!channel) {
    return NextResponse.json({ token: connectionToken(memberId) });
  }

  const allowed = await canSubscribe(channel, { workspaceId, memberId });
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ token: subscriptionToken(memberId, channel) });
}

async function canSubscribe(
  channel: string,
  ctx: { workspaceId: string; memberId: string },
): Promise<boolean> {
  const [namespace, rest] = splitChannel(channel);

  switch (namespace) {
    case "user": {
      // user:<memberId>#<memberId> — only the owner may read their stream.
      const id = rest.split("#")[0];
      return id === ctx.memberId && channel.endsWith(`#${ctx.memberId}`);
    }
    case "presence": {
      return rest === ctx.workspaceId;
    }
    case "project": {
      const access = await getProjectAccess(rest);
      return access.hasAccess;
    }
    case "task": {
      const task = await db.task.findFirst({
        where: { id: rest, project: { workspaceId: ctx.workspaceId } },
        select: { projectId: true },
      });
      if (!task) return false;
      const access = await getProjectAccess(task.projectId);
      return access.hasAccess;
    }
    case "conv": {
      const participant = await db.conversationParticipant.findFirst({
        where: {
          conversationId: rest,
          memberId: ctx.memberId,
          conversation: { workspaceId: ctx.workspaceId },
        },
        select: { id: true },
      });
      return Boolean(participant);
    }
    default:
      return false;
  }
}

function splitChannel(channel: string): [string, string] {
  const idx = channel.indexOf(":");
  if (idx === -1) return [channel, ""];
  return [channel.slice(0, idx), channel.slice(idx + 1)];
}
