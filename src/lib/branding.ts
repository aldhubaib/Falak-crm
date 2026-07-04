import { db } from "@/lib/db";
import type { BrandingStorageSlot } from "@/lib/branding-slots";

// Static files shipped with the app, used until a custom asset is uploaded.
export const BRANDING_FALLBACKS: Partial<Record<BrandingStorageSlot, string>> = {
  favicon: "/favicon.png",
  faviconDark: "/favicon.png",
  appleTouchIcon: "/icons/ios-180.png?v=2",
  androidAny192: "/icons/android-192.png?v=2",
  androidAny512: "/icons/android-512.png?v=2",
  androidMaskable192: "/icons/android-192.png?v=2",
  androidMaskable512: "/icons/android-512.png?v=2",
  webLogo: "/falak-mark.svg",
};

// slot → updatedAt (ms) for every uploaded branding asset. Returns an empty
// map when the DB is unreachable so the favicon/manifest never hard-fail —
// callers then fall back to the static files.
export async function getBrandingVersions(): Promise<Record<string, number>> {
  try {
    const rows = await db.brandingAsset.findMany({
      select: { slot: true, updatedAt: true },
    });
    return Object.fromEntries(rows.map((r) => [r.slot, r.updatedAt.getTime()]));
  } catch {
    return {};
  }
}

// URL for a branding slot: the versioned serving route when a custom asset
// exists, otherwise the static fallback (or null when there is none).
export function brandingUrl(
  versions: Record<string, number>,
  slot: BrandingStorageSlot,
): string | null {
  const v = versions[slot];
  if (v) return `/api/public/branding/${slot}?v=${v}`;
  return BRANDING_FALLBACKS[slot] ?? null;
}
