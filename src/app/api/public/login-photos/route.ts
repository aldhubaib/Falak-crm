import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPresignedGet } from "@/lib/storage";

// Public (pre-auth) endpoint: returns the sign-in gallery photos as presigned
// GET URLs so the login page can render them without a session. Only exposes
// images that were explicitly published for the login page.
export async function GET() {
  try {
    const photos = await db.loginPhoto.findMany({
      orderBy: [{ column: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    });

    const data = await Promise.all(
      photos.map(async (p) => ({
        id: p.id,
        column: p.column === "b" ? "b" : "a",
        url: await createPresignedGet(p.r2Key),
      })),
    );

    return NextResponse.json(
      { photos: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ photos: [] }, { status: 200 });
  }
}
