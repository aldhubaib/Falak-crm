// One-time Clerk allowlist sync — makes sign-in behave like an invite-only
// door: emails that aren't on the team are rejected right on the sign-in form
// ("<email> is not allowed to access this application") instead of signing up
// and landing on /not-invited.
//
//   1. Reads every team member email from the database.
//   2. Adds the missing ones to the Clerk allowlist.
//   3. Enables the allowlist restriction on the Clerk instance.
//
// Dry-run by default; pass --apply to write.
//
//   npx tsx --env-file=.env scripts/sync-clerk-allowlist.ts [--apply]
//
// Going forward, Settings → Team keeps the allowlist in sync automatically
// (inviteMember adds, removeMember deletes).
import { createClerkClient } from "@clerk/backend";
import { db } from "../src/lib/db";

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "dry-run"}\n`);

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("CLERK_SECRET_KEY is not set");
  const clerk = createClerkClient({ secretKey });

  const members = await db.workspaceMember.findMany({
    select: { email: true, name: true, type: true },
  });
  const teamEmails = new Set(
    members.map((m) => m.email.trim().toLowerCase()).filter(Boolean),
  );
  console.log(`Team emails in DB: ${teamEmails.size}`);

  // Current allowlist state.
  const existing = new Set<string>();
  let offset = 0;
  for (;;) {
    const page = await clerk.allowlistIdentifiers.getAllowlistIdentifierList({
      limit: 100,
      offset,
    });
    for (const a of page.data) existing.add(a.identifier.toLowerCase());
    offset += page.data.length;
    if (page.data.length < 100 || offset >= page.totalCount) break;
  }
  console.log(`Already on Clerk allowlist: ${existing.size}\n`);

  const missing = [...teamEmails].filter((e) => !existing.has(e));
  for (const email of missing) {
    if (APPLY) {
      await clerk.allowlistIdentifiers.createAllowlistIdentifier({
        identifier: email,
        notify: false,
      });
      console.log(`  + added   ${email}`);
    } else {
      console.log(`  + would add ${email}`);
    }
  }
  if (missing.length === 0) console.log("  (nothing to add)");

  // Identifiers on the allowlist that aren't team members — listed for review
  // only, never auto-removed (they may be intentional, e.g. a domain rule).
  const strays = [...existing].filter((e) => !teamEmails.has(e));
  if (strays.length > 0) {
    console.log(`\nOn allowlist but not in the team (left untouched):`);
    for (const e of strays) console.log(`  ? ${e}`);
  }

  if (APPLY) {
    const restrictions = await clerk.instance.updateRestrictions({
      allowlist: true,
    });
    console.log(`\nAllowlist restriction enabled: ${restrictions.allowlist}`);
  } else {
    console.log(`\nWould enable the allowlist restriction on the instance.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
