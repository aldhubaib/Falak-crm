import { NextResponse } from "next/server";
import { getBrandingVersions, brandingUrl } from "@/lib/branding";

export const dynamic = "force-dynamic";

// PWA manifest built at request time so the icons uploaded in Settings →
// App Logo take effect without a deploy. Installed PWAs re-fetch the manifest
// periodically and pick up the new (versioned) icon URLs.
export async function GET() {
  const versions = await getBrandingVersions();

  const icons = [
    {
      src: brandingUrl(versions, "androidAny192")!,
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: brandingUrl(versions, "androidAny512")!,
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: brandingUrl(versions, "androidMaskable192")!,
      sizes: "192x192",
      type: "image/png",
      purpose: "maskable",
    },
    {
      src: brandingUrl(versions, "androidMaskable512")!,
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ];

  if (versions.androidMonochrome) {
    icons.push({
      src: brandingUrl(versions, "androidMonochrome")!,
      sizes: "512x512",
      type: "image/png",
      purpose: "monochrome",
    });
  }

  return NextResponse.json(
    {
      name: "Falak",
      short_name: "Falak",
      description: "CRM & Bookkeeping for marketing agencies",
      start_url: "/dashboard",
      display: "standalone",
      background_color: "#0e0e10",
      theme_color: "#0e0e10",
      orientation: "any",
      icons,
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        // Short cache so icon changes propagate quickly to installed PWAs.
        "Cache-Control": "public, max-age=300, must-revalidate",
      },
    },
  );
}
