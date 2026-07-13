import { clerkClient } from "@clerk/nextjs/server";

// Clerk's allowlist restriction rejects unknown emails right on the sign-in
// form ("<email> is not allowed to access this application") instead of
// letting them sign up and land on /not-invited. These helpers keep the
// allowlist in sync with the team roster. Both are best-effort: the DB member
// row is the source of truth for access, and /not-invited remains the
// backstop if a Clerk call fails.

export async function addToClerkAllowlist(email: string): Promise<void> {
  const identifier = email.trim().toLowerCase();
  if (!identifier) return;
  try {
    const client = await clerkClient();
    await client.allowlistIdentifiers.createAllowlistIdentifier({
      identifier,
      notify: false,
    });
  } catch (err) {
    // Duplicate identifiers and plan restrictions land here — never block the
    // team action itself.
    console.error(`[clerk-allowlist] failed to add ${identifier}:`, err);
  }
}

export async function removeFromClerkAllowlist(email: string): Promise<void> {
  const identifier = email.trim().toLowerCase();
  if (!identifier) return;
  try {
    const client = await clerkClient();
    let offset = 0;
    for (;;) {
      const page = await client.allowlistIdentifiers.getAllowlistIdentifierList(
        { limit: 100, offset },
      );
      const match = page.data.find(
        (a) => a.identifier.toLowerCase() === identifier,
      );
      if (match) {
        await client.allowlistIdentifiers.deleteAllowlistIdentifier(match.id);
        return;
      }
      offset += page.data.length;
      if (page.data.length < 100 || offset >= page.totalCount) return;
    }
  } catch (err) {
    console.error(`[clerk-allowlist] failed to remove ${identifier}:`, err);
  }
}
