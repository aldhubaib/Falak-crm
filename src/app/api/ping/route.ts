// Tiny connectivity probe for the offline banner: no auth, no DB — any
// response at all proves the network path to the server works. Lives under
// /api/ so the service worker never serves it from cache.
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
