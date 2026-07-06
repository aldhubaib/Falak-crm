/**
 * One-time backfill: send Clerk invitations to workspace members who were
 * invited before the app started registering invites with Clerk. Only members
 * whose userId is still a `pending_*` placeholder (never signed in) are
 * affected — everyone else already has a working Clerk account.
 *
 * The Clerk instance runs in restricted (invite-only) sign-up mode, so without
 * an invitation Clerk rejects their first Google sign-in with
 * `authorization_invalid`. Requires "Sign-up with email" to be enabled in the
 * Clerk Dashboard (invitations are unsupported otherwise).
 *
 * Run with production credentials:
 *   DATABASE_URL=… CLERK_SECRET_KEY=… npx tsx scripts/send-clerk-invites.ts
 *
 * Pass --dry to only list pending members without sending anything.
 */
import { config } from "dotenv";
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

config();

const dry = process.argv.includes("--dry");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const pending = await db.workspaceMember.findMany({
    where: { userId: { startsWith: "pending_" } },
    select: { id: true, name: true, email: true },
    orderBy: { joinedAt: "asc" },
  });
  console.log(`Found ${pending.length} pending member(s):`);
  for (const m of pending) console.log(`  - ${m.name ?? "?"} <${m.email}>`);
  if (pending.length === 0 || dry) return;

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("CLERK_SECRET_KEY is not set");
  const clerk = createClerkClient({ secretKey });

  for (const m of pending) {
    if (!m.email) {
      console.log(`Skipping ${m.name ?? m.id} — no email on record.`);
      continue;
    }
    try {
      await clerk.invitations.createInvitation({
        emailAddress: m.email,
        redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://panel.falak.media"}/sign-in`,
        notify: true,
        ignoreExisting: true,
      });
      console.log(`Invited ${m.email}`);
    } catch (e) {
      console.error(`Failed for ${m.email}:`, e);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
