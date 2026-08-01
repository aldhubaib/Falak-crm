/**
 * Extract a YouTube video id from any shape a person might paste: youtu.be
 * links, watch URLs carrying playlist and timestamp params, shorts, embeds and
 * live URLs. A silent parse failure looks identical to a video with no
 * captions, so this is worth getting right.
 */
export function parseVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // A bare id pasted on its own.
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return id || null;
    }
    if (!host.endsWith("youtube.com")) return null;

    const v = url.searchParams.get("v");
    if (v) return v;

    const match = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function isYouTubeUrl(input: string): boolean {
  return parseVideoId(input) !== null;
}

export function watchUrl(videoId: string, atSeconds?: number): string {
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  return atSeconds ? `${base}&t=${Math.floor(atSeconds)}s` : base;
}
