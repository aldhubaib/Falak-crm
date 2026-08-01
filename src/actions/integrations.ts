"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { safeAction, type ActionResult } from "@/lib/action";
import { requireWorkspaceWithMember } from "@/lib/workspace";
import { canEdit } from "@/lib/permissions";
import {
  decryptSecret,
  encryptSecret,
  isSecretsKeyConfigured,
  maskSecret,
} from "@/lib/secrets";
import { getProvider } from "@/lib/integrations";

export type IntegrationDTO = {
  provider: string;
  configured: boolean;
  enabled: boolean;
  /** Masked values, safe to render. Secrets never leave the server. */
  hints: Record<string, string>;
  lastVerifiedAt: number | null;
  lastVerifyError: string | null;
  updatedAt: number | null;
};

async function requireSettingsEditor() {
  const { workspace, member } = await requireWorkspaceWithMember();
  if (!canEdit(member, "settings")) throw new Error("Permission denied");
  return { workspace, member };
}

export async function getIntegrations(): Promise<{
  items: IntegrationDTO[];
  secretsKeyConfigured: boolean;
}> {
  const { workspace } = await requireSettingsEditor();

  const rows = await db.integrationCredential.findMany({
    where: { workspaceId: workspace.id },
  });

  return {
    secretsKeyConfigured: isSecretsKeyConfigured(),
    items: rows.map((row) => ({
      provider: row.provider,
      configured: true,
      enabled: row.enabled,
      hints: (row.hints as Record<string, string> | null) ?? {},
      lastVerifiedAt: row.lastVerifiedAt?.getTime() ?? null,
      lastVerifyError: row.lastVerifyError,
      updatedAt: row.updatedAt.getTime(),
    })),
  };
}

/**
 * Server-only accessor for the rest of the app. Never expose the return value
 * of this to a client component.
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
    // A failed decrypt means SECRETS_KEY changed or the row was tampered with.
    return null;
  }
}

export async function saveIntegration(
  providerId: string,
  values: Record<string, string>,
): Promise<ActionResult<void>> {
  return safeAction("Save Integration", async () => {
    const { workspace, member } = await requireSettingsEditor();

    const provider = getProvider(providerId);
    if (!provider) throw new Error("Unknown integration");
    if (!isSecretsKeyConfigured()) {
      throw new Error("SECRETS_KEY is not set on the server — cannot store credentials");
    }

    const existing = await db.integrationCredential.findUnique({
      where: { workspaceId_provider: { workspaceId: workspace.id, provider: providerId } },
    });

    // Blank secret fields mean "leave the stored value alone", so an admin can
    // edit the organization id without re-typing the API key.
    const current: Record<string, string> = existing
      ? ((): Record<string, string> => {
          try {
            return JSON.parse(decryptSecret(existing.secrets)) as Record<string, string>;
          } catch {
            return {};
          }
        })()
      : {};

    const merged: Record<string, string> = { ...current };
    for (const field of provider.fields) {
      const incoming = (values[field.key] ?? "").trim();
      if (incoming) merged[field.key] = incoming;
      else if (!field.secret) delete merged[field.key];
    }

    for (const field of provider.fields) {
      if (field.secret && !merged[field.key]) {
        throw new Error(`${field.label} is required`);
      }
    }

    const hints: Record<string, string> = {};
    for (const field of provider.fields) {
      const value = merged[field.key];
      if (!value) continue;
      hints[field.key] = field.secret ? maskSecret(value) : value;
    }

    await db.integrationCredential.upsert({
      where: { workspaceId_provider: { workspaceId: workspace.id, provider: providerId } },
      create: {
        workspaceId: workspace.id,
        provider: providerId,
        secrets: encryptSecret(JSON.stringify(merged)),
        hints,
        updatedBy: member.id,
      },
      update: {
        secrets: encryptSecret(JSON.stringify(merged)),
        hints,
        updatedBy: member.id,
        // Credentials changed, so any previous verdict is stale.
        lastVerifiedAt: null,
        lastVerifyError: null,
      },
    });

    revalidatePath("/settings/integrations");
  });
}

export async function setIntegrationEnabled(
  providerId: string,
  enabled: boolean,
): Promise<ActionResult<void>> {
  return safeAction("Toggle Integration", async () => {
    const { workspace } = await requireSettingsEditor();
    await db.integrationCredential.update({
      where: { workspaceId_provider: { workspaceId: workspace.id, provider: providerId } },
      data: { enabled },
    });
    revalidatePath("/settings/integrations");
  });
}

export async function removeIntegration(providerId: string): Promise<ActionResult<void>> {
  return safeAction("Remove Integration", async () => {
    const { workspace } = await requireSettingsEditor();
    await db.integrationCredential.deleteMany({
      where: { workspaceId: workspace.id, provider: providerId },
    });
    revalidatePath("/settings/integrations");
  });
}

export async function testIntegration(
  providerId: string,
): Promise<ActionResult<{ ok: boolean; message: string }>> {
  return safeAction("Test Integration", async () => {
    const { workspace } = await requireSettingsEditor();

    const provider = getProvider(providerId);
    if (!provider?.testable) throw new Error("This integration cannot be tested");

    const secrets = await getIntegrationSecrets(workspace.id, providerId);
    if (!secrets) throw new Error("No credentials stored, or they failed to decrypt");

    const result = await probe(providerId, secrets);

    await db.integrationCredential.update({
      where: { workspaceId_provider: { workspaceId: workspace.id, provider: providerId } },
      data: {
        lastVerifiedAt: result.ok ? new Date() : null,
        lastVerifyError: result.ok ? null : result.message,
      },
    });

    revalidatePath("/settings/integrations");
    return result;
  });
}

/** Cheapest call each provider offers that proves the credential works. */
async function probe(
  providerId: string,
  secrets: Record<string, string>,
): Promise<{ ok: boolean; message: string }> {
  const timeout = AbortSignal.timeout(15_000);

  try {
    switch (providerId) {
      case "openai": {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: {
            Authorization: `Bearer ${secrets.apiKey}`,
            ...(secrets.organization ? { "OpenAI-Organization": secrets.organization } : {}),
          },
          signal: timeout,
        });
        return res.ok
          ? { ok: true, message: "Key accepted" }
          : { ok: false, message: `OpenAI returned ${res.status}` };
      }
      case "anthropic": {
        const res = await fetch("https://api.anthropic.com/v1/models", {
          headers: {
            "x-api-key": secrets.apiKey,
            "anthropic-version": "2023-06-01",
          },
          signal: timeout,
        });
        return res.ok
          ? { ok: true, message: "Key accepted" }
          : { ok: false, message: `Anthropic returned ${res.status}` };
      }
      case "deepgram": {
        const res = await fetch("https://api.deepgram.com/v1/projects", {
          headers: { Authorization: `Token ${secrets.apiKey}` },
          signal: timeout,
        });
        return res.ok
          ? { ok: true, message: "Key accepted" }
          : { ok: false, message: `Deepgram returned ${res.status}` };
      }
      case "youtube_data": {
        // Cheapest possible read: one video id, id part only, 1 quota unit.
        const url = new URL("https://www.googleapis.com/youtube/v3/videos");
        url.searchParams.set("part", "id");
        url.searchParams.set("id", "jNQXAC9IVRw");
        url.searchParams.set("key", secrets.apiKey);
        const res = await fetch(url, { signal: timeout });
        if (res.ok) return { ok: true, message: "Key accepted" };
        const detail = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        return {
          ok: false,
          message: detail?.error?.message ?? `YouTube returned ${res.status}`,
        };
      }
      case "serpapi": {
        // The account endpoint validates the key without spending a search.
        const url = new URL("https://serpapi.com/account");
        url.searchParams.set("api_key", secrets.apiKey);
        const res = await fetch(url, { signal: timeout });
        if (!res.ok) return { ok: false, message: `SerpAPI returned ${res.status}` };
        const account = (await res.json().catch(() => null)) as
          | { total_searches_left?: number }
          | null;
        return {
          ok: true,
          message:
            typeof account?.total_searches_left === "number"
              ? `Key accepted — ${account.total_searches_left} searches left`
              : "Key accepted",
        };
      }
      case "youtube_transcript": {
        // No credential-only endpoint exists, so this spends one token.
        const res = await fetch("https://www.youtube-transcript.io/api/transcripts", {
          method: "POST",
          headers: {
            Authorization: `Basic ${secrets.apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids: ["jNQXAC9IVRw"] }),
          signal: timeout,
        });
        if (res.status === 429) return { ok: false, message: "Rate limited — try again shortly" };
        return res.ok
          ? { ok: true, message: "Token accepted" }
          : { ok: false, message: `Transcript API returned ${res.status}` };
      }
      default:
        return { ok: false, message: "No test available" };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message: message.includes("timeout") ? "Request timed out" : message };
  }
}
