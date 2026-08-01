// Registry of third-party services the app can hold credentials for.
//
// Adding a provider here is all that's needed for it to appear on
// Settings → Integrations; the page renders from this list.

export type IntegrationField = {
  key: string;
  label: string;
  placeholder: string;
  /** Secret fields are write-only: stored encrypted, never sent back. */
  secret: boolean;
  help?: string;
};

export type IntegrationProvider = {
  id: string;
  name: string;
  /** Which part of the app stops working without it. */
  module: string;
  description: string;
  docsUrl: string;
  fields: IntegrationField[];
  /** Whether the credential can be checked with a live call. */
  testable: boolean;
  /** Shown next to the Test button when verifying is not free. */
  testCost?: string;
  /** Provider is configured on its own page instead of here. */
  managedAt?: string;
};

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    module: "Script",
    description:
      "Cleaning, entity extraction, translation and fact extraction. The bulk of token spend runs through this key.",
    docsUrl: "https://platform.openai.com/api-keys",
    testable: true,
    fields: [
      {
        key: "apiKey",
        label: "API key",
        placeholder: "sk-...",
        secret: true,
      },
      {
        key: "organization",
        label: "Organization ID",
        placeholder: "org-... (optional)",
        secret: false,
        help: "Only needed if your account belongs to several organizations.",
      },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    module: "Script",
    description:
      "Alternative writer for the Kuwaiti draft. Optional, but needed to compare dialect quality between models.",
    docsUrl: "https://console.anthropic.com/settings/keys",
    testable: true,
    fields: [
      { key: "apiKey", label: "API key", placeholder: "sk-ant-...", secret: true },
    ],
  },
  {
    id: "youtube_transcript",
    name: "YouTube Transcript",
    module: "Script",
    description:
      "Pulls captions for YouTube references. The primary path for every YouTube source.",
    docsUrl: "https://www.youtube-transcript.io/api",
    testable: true,
    testCost: "Testing fetches one transcript and spends a token.",
    fields: [
      { key: "apiToken", label: "API token", placeholder: "Token from your profile", secret: true },
    ],
  },
  {
    id: "youtube_data",
    name: "YouTube Data API v3",
    module: "Script",
    description:
      "Video metadata for YouTube references — title, channel, publish date, duration. Feeds the source trust level.",
    docsUrl: "https://console.cloud.google.com/apis/credentials",
    testable: true,
    fields: [
      { key: "apiKey", label: "API key", placeholder: "AIza...", secret: true },
    ],
  },
  {
    id: "serpapi",
    name: "SerpAPI",
    module: "Script",
    description:
      "Image and web search for visual research. 100 searches a month on the free tier.",
    docsUrl: "https://serpapi.com/manage-api-key",
    testable: true,
    fields: [
      { key: "apiKey", label: "API key", placeholder: "SerpAPI private key", secret: true },
    ],
  },
  {
    id: "deepgram",
    name: "Deepgram",
    module: "Script",
    description:
      "Speech-to-text fallback for videos with no captions. Supports Kuwaiti Arabic (ar-KW).",
    docsUrl: "https://console.deepgram.com/",
    testable: true,
    fields: [
      { key: "apiKey", label: "API key", placeholder: "Deepgram API key", secret: true },
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp Cloud API",
    module: "Messaging",
    description: "Sends invoices and notifications over WhatsApp.",
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api",
    testable: false,
    managedAt: "/settings/integrations/whatsapp",
    fields: [],
  },
];

export function getProvider(id: string): IntegrationProvider | undefined {
  return INTEGRATION_PROVIDERS.find((p) => p.id === id);
}

/** Providers grouped by the module they serve, for the settings page. */
export function providersByModule(): { module: string; providers: IntegrationProvider[] }[] {
  const groups = new Map<string, IntegrationProvider[]>();
  for (const p of INTEGRATION_PROVIDERS) {
    groups.set(p.module, [...(groups.get(p.module) ?? []), p]);
  }
  return [...groups.entries()].map(([module, providers]) => ({ module, providers }));
}
