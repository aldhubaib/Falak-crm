// One-shot production smoke test for the Centrifugo deployment.
// Verifies: WS connect (JWT), channel subscribe (JWT), presence, server-side
// HTTP API publish -> client delivery, and client publish (typing path).
// Usage: CENT_SECRET=... CENT_API_KEY=... node scripts/verify-centrifugo.mjs
import crypto from "node:crypto";
import { Centrifuge } from "centrifuge";

const WS = "wss://centrifugo-production-1fe2.up.railway.app/connection/websocket";
const API = "https://centrifugo-production-1fe2.up.railway.app/api";
const SECRET = process.env.CENT_SECRET;
const API_KEY = process.env.CENT_API_KEY;

const b64u = (b) => Buffer.from(b).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
function jwt(payload) {
  const data = `${b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64u(JSON.stringify(payload))}`;
  return `${data}.${b64u(crypto.createHmac("sha256", SECRET).update(data).digest())}`;
}
const now = () => Math.floor(Date.now() / 1000);
const connToken = (sub) => jwt({ sub, iat: now(), exp: now() + 3600 });
const subToken = (sub, channel) => jwt({ sub, channel, iat: now(), exp: now() + 3600 });

const CHANNEL = "conv:smoke-test";
const results = [];
const ok = (name) => { results.push(`PASS ${name}`); console.log(`PASS ${name}`); };
const fail = (name, e) => { results.push(`FAIL ${name}: ${e}`); console.log(`FAIL ${name}: ${e}`); };

function makeClient(user) {
  const c = new Centrifuge(WS, { getToken: async () => connToken(user) });
  return c;
}

const timeout = (ms, label) => new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout: ${label}`)), ms));

async function main() {
  const a = makeClient("member-a");
  const b = makeClient("member-b");

  // 1. Connect both
  const connectedBoth = Promise.all([
    new Promise((res) => a.on("connected", res)),
    new Promise((res) => b.on("connected", res)),
  ]);
  a.connect(); b.connect();
  try {
    await Promise.race([connectedBoth, timeout(10000, "connect")]);
    ok("ws connect (both clients)");
  } catch (e) {
    fail("ws connect", e.message);
    process.exit(1);
  }

  // 2. Subscribe both to the conv channel
  const subA = a.newSubscription(CHANNEL, { getToken: async () => subToken("member-a", CHANNEL) });
  const subB = b.newSubscription(CHANNEL, { getToken: async () => subToken("member-b", CHANNEL) });
  const gotB = new Promise((res) => subB.on("publication", (ctx) => { if (ctx.data?.type === "message.new") res(ctx.data); }));
  const gotTypingA = new Promise((res) => subA.on("publication", (ctx) => { if (ctx.data?.type === "typing") res(ctx.data); }));
  const subscribedBoth = Promise.all([
    new Promise((res, rej) => { subA.on("subscribed", res); subA.on("error", (c) => rej(new Error(JSON.stringify(c)))); }),
    new Promise((res, rej) => { subB.on("subscribed", res); subB.on("error", (c) => rej(new Error(JSON.stringify(c)))); }),
  ]);
  subA.subscribe(); subB.subscribe();
  try {
    await Promise.race([subscribedBoth, timeout(10000, "subscribe")]);
    ok("channel subscribe with sub token");
  } catch (e) { fail("channel subscribe", e.message); }
  await new Promise((res) => setTimeout(res, 1500));

  // 3. Presence shows both members
  try {
    const p = await subA.presence();
    const users = new Set(Object.values(p.clients).map((c) => c.user));
    if (users.has("member-a") && users.has("member-b")) ok(`presence (${[...users].join(", ")})`);
    else fail("presence", `only saw: ${[...users].join(", ")}`);
  } catch (e) { fail("presence", e.message); }

  // 4. Server HTTP API publish -> delivered to subscriber B
  try {
    const res = await fetch(`${API}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
      body: JSON.stringify({ channel: CHANNEL, data: { type: "message.new", message: { id: "smoke-1" } } }),
    });
    const body = await res.json();
    if (!res.ok || body.error) throw new Error(JSON.stringify(body));
    await Promise.race([gotB, timeout(5000, "delivery to B")]);
    ok("server publish -> client delivery");
  } catch (e) { fail("server publish -> delivery", e.message); }

  // 5. Client publish (typing) from B -> received by A
  try {
    await subB.publish({ type: "typing", memberId: "member-b" });
    await Promise.race([gotTypingA, timeout(5000, "typing to A")]);
    ok("client publish (typing) -> peer delivery");
  } catch (e) { fail("client publish (typing)", e.message); }

  a.disconnect(); b.disconnect();
  const failed = results.filter((r) => r.startsWith("FAIL"));
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
