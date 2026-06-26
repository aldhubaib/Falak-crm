import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = await db.taskChecklistItem.findMany({
    where: { taskId: id },
    select: { id: true, templateItemId: true },
  });
  return NextResponse.json(items);
}
