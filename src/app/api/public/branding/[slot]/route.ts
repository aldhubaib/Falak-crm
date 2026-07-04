import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { BRANDING_FALLBACKS } from "@/lib/branding";
import type { BrandingStorageSlot } from "@/lib/branding-slots";

export const dynamic = "force-dynamic";

const KNOWN_SLOTS = new Set<string>([
  "favicon",
  "faviconDark",
  "appleTouchIcon",
  "androidAny192",
  "androidAny512",
  "androidMaskable192",
  "androidMaskable512",
  "webLogo",
  "ogImage",
  "androidMonochrome",
  "iosSplash",
]);

// Public (pre-auth) endpoint that serves the uploaded branding assets: the
// favicon, manifest icons, apple-touch-icon, web logo, and OG image all point
// here. Falls back to the static files shipped with the app when no custom
// asset has been uploaded, so every consumer can reference this route
// unconditionally.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slot: string }> },
) {
  const { slot } = await params;
  if (!KNOWN_SLOTS.has(slot)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let row = null;
  try {
    row = await db.brandingAsset.findUnique({ where: { slot } });
  } catch {
    // DB unreachable — behave like "no custom asset"
  }

  if (!row) {
    const fallback = BRANDING_FALLBACKS[slot as BrandingStorageSlot];
    if (!fallback) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.redirect(new URL(fallback, request.url), {
      status: 302,
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  const etag = `"${row.updatedAt.getTime()}"`;
  // Versioned URLs (manifest, metadata) may cache forever — a new upload bumps
  // the version. Unversioned hits revalidate within minutes.
  const cacheControl = request.nextUrl.searchParams.has("v")
    ? "public, max-age=31536000, immutable"
    : "public, max-age=300, must-revalidate";

  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": cacheControl },
    });
  }

  const bytes = await getObject(row.r2Key);
  if (!bytes) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": row.contentType,
      "Content-Length": String(bytes.byteLength),
      ETag: etag,
      "Cache-Control": cacheControl,
    },
  });
}
