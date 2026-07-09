"use server";

import { auth } from "@clerk/nextjs/server";
import { cached } from "@/lib/cache";

// Fetches lightweight metadata (site name, title, icon) for a URL pasted in
// chat, so the client can render a link-preview card. Results are cached in
// Redis for a day — the same link shared around a team resolves once.

export type LinkPreview = {
  url: string;
  host: string;
  /** Site display name (og:site_name), falls back to the host. */
  siteName: string;
  /** Page title (og:title / <title>), when present. */
  title: string | null;
  /** Absolute icon URL (apple-touch-icon → favicon → /favicon.ico). */
  icon: string | null;
};

const FETCH_TIMEOUT_MS = 5_000;
const MAX_HTML_BYTES = 256 * 1024;

// Basic SSRF guard: never let the server fetch internal/private addresses.
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) {
    return true;
  }
  // IPv6 literals (e.g. [::1]) — block all of them outright.
  if (h.includes(":")) return true;
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function attr(tag: string, name: string): string | null {
  const m =
    tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i")) ??
    tag.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`, "i"));
  return m ? decodeEntities(m[1]) : null;
}

function metaContent(html: string, key: string): string | null {
  for (const tag of html.match(/<meta\s[^>]*>/gi) ?? []) {
    const prop = attr(tag, "property") ?? attr(tag, "name");
    if (prop?.toLowerCase() === key) {
      const content = attr(tag, "content");
      if (content) return content.trim();
    }
  }
  return null;
}

function findIcon(html: string, base: URL): string | null {
  let favicon: string | null = null;
  for (const tag of html.match(/<link\s[^>]*>/gi) ?? []) {
    const rel = (attr(tag, "rel") ?? "").toLowerCase();
    const href = attr(tag, "href");
    if (!href) continue;
    try {
      const abs = new URL(href, base).toString();
      // Prefer the large touch icon; remember the first plain favicon.
      if (rel.includes("apple-touch-icon")) return abs;
      if (rel.split(/\s+/).includes("icon") && !favicon) favicon = abs;
    } catch {
      // Unresolvable href — skip.
    }
  }
  return favicon ?? new URL("/favicon.ico", base).toString();
}

async function loadPreview(url: string): Promise<LinkPreview | null> {
  const target = new URL(url);
  const fallback: LinkPreview = {
    url,
    host: target.hostname.replace(/^www\./, ""),
    siteName: target.hostname.replace(/^www\./, ""),
    title: null,
    icon: new URL("/favicon.ico", target).toString(),
  };

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // Some sites only serve OG tags to identifiable browsers/bots.
        "User-Agent":
          "Mozilla/5.0 (compatible; FalakCRM-LinkPreview/1.0; +https://falak.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) {
      return fallback;
    }

    // Read at most MAX_HTML_BYTES — metadata lives in <head>.
    const reader = res.body?.getReader();
    if (!reader) return fallback;
    let html = "";
    let received = 0;
    const decoder = new TextDecoder();
    while (received < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      html += decoder.decode(value, { stream: true });
    }
    void reader.cancel().catch(() => {});

    const base = new URL(res.url || url);
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
    return {
      url,
      host: base.hostname.replace(/^www\./, ""),
      siteName:
        metaContent(html, "og:site_name") ??
        base.hostname.replace(/^www\./, ""),
      title:
        metaContent(html, "og:title") ??
        (titleTag ? decodeEntities(titleTag).trim() : null),
      icon: findIcon(html, base),
    };
  } catch {
    // Unreachable/slow site — still show the bare host card.
    return fallback;
  }
}

export async function getLinkPreview(rawUrl: string): Promise<LinkPreview | null> {
  const { userId } = await auth();
  if (!userId) return null;

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return null;
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") return null;
  if (isBlockedHost(target.hostname)) return null;

  const key = `linkpreview:${target.toString()}`;
  return cached(key, 24 * 60 * 60, () => loadPreview(target.toString()));
}
