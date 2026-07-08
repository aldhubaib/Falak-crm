import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { ErrorToast } from "@/components/error-toast";
import { getBrandingVersions, brandingUrl } from "@/lib/branding";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// iOS reads the apple icon; Android reads the manifest icons — separate
// slots so each platform can have its own artwork. Icons uploaded in
// Settings → App Logo are served versioned (?v=updatedAt) from
// /api/public/branding/* so a new upload takes effect without a deploy.
export async function generateMetadata(): Promise<Metadata> {
  const versions = await getBrandingVersions();

  // When a dark-mode favicon is uploaded, emit both variants with
  // prefers-color-scheme media queries so the browser picks the right one.
  const favicon = brandingUrl(versions, "favicon")!;
  const icon = versions.faviconDark
    ? [
        { url: favicon, media: "(prefers-color-scheme: light)" },
        {
          url: brandingUrl(versions, "faviconDark")!,
          media: "(prefers-color-scheme: dark)",
        },
      ]
    : favicon;

  return {
    title: "Falak CRM",
    description: "CRM & Bookkeeping for marketing agencies",
    manifest: "/manifest.json",
    icons: {
      icon,
      apple: brandingUrl(versions, "appleTouchIcon")!,
    },
    openGraph: versions.ogImage
      ? {
          title: "Falak CRM",
          description: "CRM & Bookkeeping for marketing agencies",
          images: [
            {
              url: brandingUrl(versions, "ogImage")!,
              width: 1200,
              height: 630,
            },
          ],
        }
      : undefined,
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Falak CRM",
      startupImage: versions.iosSplash
        ? [{ url: brandingUrl(versions, "iosSplash")! }]
        : undefined,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0e0e10",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // overscroll-none must be on <html>: Chrome 93+ reads the viewport's
      // overscroll-behavior from the root element, so body alone doesn't
      // block the browser's native pull-to-refresh reload.
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased overscroll-none`}
    >
      <body className="min-h-full bg-background text-foreground overscroll-none">
        <ClerkProvider
          afterSignOutUrl="/sign-in"
          appearance={{ baseTheme: dark }}
        >
          <Providers>
            {children}
            <ErrorToast />
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
