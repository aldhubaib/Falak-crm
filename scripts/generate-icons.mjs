// Renders the PWA app icons from public/falak-mark.svg.
// Run manually after changing the logo: node scripts/generate-icons.mjs
// Then bump the ?v= query on the icon URLs in public/manifest.json and
// src/app/layout.tsx so installed PWAs pick up the new artwork.
import sharp from "sharp";
import { readFileSync } from "fs";

const mark = readFileSync("public/falak-mark.svg");
const BG = "#0e0e10";

async function icon(size, markRatio, out) {
  const markSize = Math.round(size * markRatio);
  const markPng = await sharp(mark).resize(markSize, markSize).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: markPng, gravity: "center" }])
    .png()
    .toFile(out);
  console.log("wrote", out);
}

// iOS (apple-touch-icon): iOS rounds the corners itself, so the mark can sit
// larger on the square canvas.
await icon(180, 0.62, "public/icons/ios-180.png");

// Android (manifest icons, purpose "any" + "maskable"): launchers may crop up
// to ~20% from every edge for maskable shapes, so keep the mark inside the
// central 80% safe zone.
await icon(192, 0.52, "public/icons/android-192.png");
await icon(512, 0.52, "public/icons/android-512.png");
