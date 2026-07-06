// One-time fix for the iOS home-screen icon (appleTouchIcon slot).
//
// The uploaded asset was a black mark on a TRANSPARENT background — iOS fills
// transparency with solid black, so the home screen showed a mangled black
// tile. Flattening alone doesn't help (black artwork on the dark brand
// background is invisible), so this replaces the stored bytes with the
// properly designed bundled icon (white circle mark on dark, matching the
// Android icons). New uploads are auto-flattened by setBrandingAsset.
//
// Run with the target database:
//   DATABASE_URL=<prod url> npx tsx --env-file=.env scripts/flatten-apple-icon.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/lib/db";
import { uploadBytes } from "../src/lib/storage";

async function main() {
  const row = await db.brandingAsset.findUnique({
    where: { slot: "appleTouchIcon" },
  });
  if (!row) {
    console.log("No appleTouchIcon asset uploaded — nothing to do.");
    return;
  }

  const iconPath = path.join(process.cwd(), "public/icons/ios-180.png");
  const bytes = await readFile(iconPath);

  await uploadBytes(bytes, row.r2Key, "image/png");
  // Touch the row so the versioned URL changes and caches revalidate.
  await db.brandingAsset.update({
    where: { slot: "appleTouchIcon" },
    data: { size: bytes.byteLength, width: 180, height: 180 },
  });

  console.log(`Replaced ${row.r2Key} with bundled ios-180.png (${bytes.byteLength} bytes)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
