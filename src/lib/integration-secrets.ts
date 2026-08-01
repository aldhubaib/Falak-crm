import "server-only";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/secrets";

// Deliberately NOT in src/actions: every export of a "use server" module
// becomes a callable endpoint, and this one returns plaintext credentials.
// It must stay a plain server import so it can never be reached from a
// browser.

/**
 * Decrypted credentials for a provider, or null when it is absent, disabled,
 * or undecryptable (SECRETS_KEY changed). Never return this to a client.
 */
export async function getIntegrationSecrets(
  workspaceId: string,
  providerId: string,
): Promise<Record<string, string> | null> {
  const row = await db.integrationCredential.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: providerId } },
  });
  if (!row || !row.enabled) return null;
  try {
    return JSON.parse(decryptSecret(row.secrets)) as Record<string, string>;
  } catch {
    return null;
  }
}
