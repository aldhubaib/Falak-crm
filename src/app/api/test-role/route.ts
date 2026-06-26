import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ roleName: null });

  const cookieStore = await cookies();
  const testRoleId = cookieStore.get("test_role_id")?.value;
  if (!testRoleId) return NextResponse.json({ roleName: null });

  const role = await db.role.findFirst({
    where: { id: testRoleId },
    select: { name: true },
  });

  return NextResponse.json({ roleName: role?.name ?? null });
}
