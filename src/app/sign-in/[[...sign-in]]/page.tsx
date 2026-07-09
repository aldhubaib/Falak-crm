"use client";

import { useEffect, useState } from "react";
import { SignIn } from "@clerk/nextjs";

type GalleryPhoto = { id: string; column: "a" | "b"; url: string };

export default function SignInPage() {
  return (
    <div className="flex min-h-screen w-full bg-black text-white">
      {/* Left: login form */}
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-[380px] text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* Served from Settings → App Logo when a custom web logo is uploaded;
              falls back to the bundled mark otherwise. */}
          <img
            src="/api/public/branding/webLogo"
            alt="Falak"
            className="mx-auto h-10 w-10"
          />

          <h1 className="mt-6 text-[28px] font-semibold leading-[1.2] tracking-tight text-white">
            Welcome to Falak
          </h1>
          <p className="text-[28px] font-semibold leading-[1.2] tracking-tight text-white/45">
            Start managing now.
          </p>

          {/* Clerk's prebuilt widget handles the OAuth flow, existing
              sessions, invitation tickets and callback errors. Chrome
              (card, header, footer) is stripped so only the provider
              button(s) render, styled to match the old custom button. */}
          <div className="mt-9">
            <SignIn
              fallbackRedirectUrl="/dashboard"
              appearance={{
                elements: {
                  rootBox: { width: "100%" },
                  cardBox: {
                    width: "100%",
                    boxShadow: "none",
                    background: "transparent",
                  },
                  card: {
                    width: "100%",
                    background: "transparent",
                    boxShadow: "none",
                    padding: 0,
                  },
                  header: { display: "none" },
                  headerTitle: { display: "none" },
                  headerSubtitle: { display: "none" },
                  footer: { display: "none" },
                  socialButtonsBlockButton: {
                    height: "44px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: 500,
                    "&:hover": {
                      backgroundColor: "rgba(255, 255, 255, 0.12)",
                    },
                  },
                  socialButtonsBlockButtonText: {
                    fontSize: "14px",
                    fontWeight: 500,
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Right: scrolling gallery */}
      <ScrollingGallery />
    </div>
  );
}

const CARDS_A = [
  { title: "La experiencia culinaria divina", from: "#bcdcff", to: "#e8f2ff", text: "#1a2340" },
  { title: "Bonded — WORK IS BOND", from: "#0f0f0f", to: "#1a1a1a", text: "#f2ead6" },
  { title: "Haptic — ambitious teams", from: "#ff5a2a", to: "#ff7a4a", text: "#0d0d0d" },
  { title: "Studio Portrait", from: "#f0e6d8", to: "#d9cab6", text: "#2b2416" },
  { title: "Ocean Deep", from: "#0c2340", to: "#2d8a9e", text: "#e8f4f8" },
];

const CARDS_B = [
  { title: "Visual Electric", from: "#f3ede4", to: "#dcd2c2", text: "#2b2416" },
  { title: "Algo — data visualization studio", from: "#0d0d18", to: "#1a1a2e", text: "#e8e6f5" },
  { title: "Comet — A personal AI assistant", from: "#f5efe6", to: "#e8dcc8", text: "#2b2416" },
  { title: "Sonar — Resources to get you started", from: "#0a1f14", to: "#12341f", text: "#e8f0e0" },
  { title: "Neon Mint", from: "#0d1b2a", to: "#2dd4a8", text: "#0a1a12" },
];

function ScrollingGallery() {
  // Fetch any custom photos configured in Settings → Login Page. Until they
  // load (or if none are set) the default gradient cards are shown.
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  useEffect(() => {
    let active = true;
    fetch("/api/public/login-photos")
      .then((r) => (r.ok ? r.json() : { photos: [] }))
      .then((data) => {
        if (active && Array.isArray(data?.photos)) setPhotos(data.photos);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const custom = photos.length > 0;
  const photosA = photos.filter((p) => p.column === "a");
  const photosB = photos.filter((p) => p.column === "b");

  return (
    <div className="relative hidden w-[46%] shrink-0 overflow-hidden lg:block">
      <style>{`
        @keyframes falak-scroll-up {
          from { transform: translateY(0); }
          to { transform: translateY(-50%); }
        }
        @keyframes falak-scroll-down {
          from { transform: translateY(-50%); }
          to { transform: translateY(0); }
        }
        .falak-col-a { animation: falak-scroll-up 40s linear infinite; }
        .falak-col-b { animation: falak-scroll-down 45s linear infinite; }
      `}</style>

      <div className="absolute inset-0 grid grid-cols-2 gap-4 p-4">
        <div className="relative overflow-hidden">
          <div className="falak-col-a flex flex-col gap-4">
            {custom
              ? [...photosA, ...photosA].map((p, i) => (
                  <PhotoCard key={`a-${i}`} src={p.url} />
                ))
              : [...CARDS_A, ...CARDS_A].map((c, i) => (
                  <GalleryCard key={`a-${i}`} {...c} />
                ))}
          </div>
        </div>
        <div className="relative overflow-hidden">
          <div className="falak-col-b flex flex-col gap-4">
            {custom
              ? [...photosB, ...photosB].map((p, i) => (
                  <PhotoCard key={`b-${i}`} src={p.url} />
                ))
              : [...CARDS_B, ...CARDS_B].map((c, i) => (
                  <GalleryCard key={`b-${i}`} {...c} />
                ))}
          </div>
        </div>
      </div>

      {/* Top/bottom fade for polish */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent" />
    </div>
  );
}

function PhotoCard({ src }: { src: string }) {
  return (
    <div className="aspect-[4/3] w-full overflow-hidden rounded-xl shadow-lg ring-1 ring-white/5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />
    </div>
  );
}

function GalleryCard({
  title,
  from,
  to,
  text,
}: {
  title: string;
  from: string;
  to: string;
  text: string;
}) {
  return (
    <div
      className="flex aspect-[4/3] w-full flex-col justify-end rounded-xl p-5 shadow-lg ring-1 ring-white/5"
      style={{
        backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
        color: text,
      }}
    >
      <div className="text-[15px] font-semibold leading-tight tracking-tight">{title}</div>
    </div>
  );
}
