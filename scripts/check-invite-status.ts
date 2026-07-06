/**
 * Diagnostic: show Clerk invitation status + whether an account already exists
 * for a given email. Read-only.
 *
 * Run: CLERK_SECRET_KEY=… npx tsx scripts/check-invite-status.ts <email>
 */
import { createClerkClient } from "@clerk/backend";

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx scripts/check-invite-status.ts <email>");
  process.exit(1);
}

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

async function main() {
  const invitations = await clerk.invitations.getInvitationList({ query: email });
  console.log(`Invitations matching "${email}": ${invitations.data.length}`);
  for (const inv of invitations.data) {
    console.log(
      `  - ${inv.emailAddress} | status: ${inv.status} | created: ${new Date(inv.createdAt).toISOString()} | url: ${inv.url ?? "n/a"}`,
    );
  }

  const users = await clerk.users.getUserList({ emailAddress: [email] });
  console.log(`Existing accounts with this email: ${users.data.length}`);
  for (const u of users.data) {
    console.log(
      `  - ${u.id} | ${u.firstName ?? ""} ${u.lastName ?? ""} | external accounts: ${u.externalAccounts.map((e) => e.provider).join(", ") || "none"} | created: ${new Date(u.createdAt).toISOString()}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
