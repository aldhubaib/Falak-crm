import { db } from "@/lib/db";
import {
  BRANDING_FALLBACKS,
  type BrandingStorageSlot,
} from "@/lib/branding-slots";

export { BRANDING_FALLBACKS };

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

// URL of the logo shown on invoice documents: the dedicated "Invoice logo"
// upload from Settings → App Logo, or null when nothing is uploaded.
export async function getInvoiceLogoUrl(): Promise<string | null> {
  const versions = await getBrandingVersions();
  const v = versions["invoiceLogo"];
  if (!v) return null;
  return `/api/public/branding/invoiceLogo?v=${v}`;
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
