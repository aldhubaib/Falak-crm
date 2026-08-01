// Spike configuration. Edit SOURCES and GROUND_TRUTH before the first run.
//
// Pick an episode you have ALREADY published: the finished human script is the
// only ground truth available for judging whether the extracted fact layer is
// good enough to write from.

export type SpikeSource = {
  /** Stable local id — used in filenames and in every provenance reference. */
  id: string;
  type: "youtube" | "text";
  url?: string;
  /** Pasted text, for type "text" or as a manual fallback when captions fail. */
  text?: string;
  title?: string;
  /** 3 = documentary/verified, 2 = ordinary, 1 = weak. Breaks conflict ties. */
  trustLevel?: 1 | 2 | 3;
};

export const EPISODE = {
  name: "REPLACE ME — e3wais episode name",
  /** Target runtime of the finished video, drives the draft word budget. */
  targetMinutes: 12,
};

export const SOURCES: SpikeSource[] = [
  {
    id: "s1",
    type: "youtube",
    url: "https://www.youtube.com/watch?v=REPLACE_ME",
    trustLevel: 3,
  },
  {
    id: "s2",
    type: "youtube",
    url: "https://www.youtube.com/watch?v=REPLACE_ME",
    trustLevel: 2,
  },
  {
    id: "s3",
    type: "text",
    title: "REPLACE ME — article or notes",
    text: "",
    trustLevel: 2,
  },
];

/**
 * The facts your writer considers essential, taken from the PUBLISHED script
 * and written by hand before looking at any spike output. Stage 09 measures
 * recall against this list — it is the check that catches a pipeline which
 * looks accurate but quietly drops half the story.
 */
export const GROUND_TRUTH: string[] = [
  // "The first body was found on 13 June 1983 near the river.",
];

/**
 * Model ids are env-overridable because they move fast — verify the current
 * ids with each provider before the first run rather than trusting these.
 */
export const MODELS = {
  /** Punctuation restoration, edit classification. High volume, low stakes. */
  small: process.env.SPIKE_MODEL_SMALL ?? "gpt-4o-mini",
  /** Entities, translation, fact extraction, verification. Needs solid JSON. */
  extract: process.env.SPIKE_MODEL_EXTRACT ?? "gpt-4o",
  /** Event clustering shortlist and the recall check. */
  embed: process.env.SPIKE_MODEL_EMBED ?? "text-embedding-3-large",
  /** Kuwaiti bake-off. Add or remove entries to change who competes. */
  dialect: [
    { id: process.env.SPIKE_MODEL_GPT ?? "gpt-4o", provider: "openai" as const },
    {
      id: process.env.SPIKE_MODEL_CLAUDE ?? "claude-sonnet-4-20250514",
      provider: "anthropic" as const,
    },
  ],
};

/**
 * USD per 1M tokens, for the cost line in the report. Leave a model out and
 * the report prints its token counts without a price.
 */
export const PRICES: Record<string, { in: number; out: number }> = {
  // "gpt-4o": { in: 2.5, out: 10 },
};

/** Words per minute for Kuwaiti voice-over. Calibrate from a real recording. */
export const WORDS_PER_MINUTE = 135;

/** Controlled attribute keys per entity category. */
export const ATTRIBUTE_KEYS = {
  person: [
    "age",
    "occupation",
    "nationality",
    "physical",
    "relationship",
    "status",
  ],
  location: ["location_type", "region", "distance", "description"],
  prop: ["prop_type", "colour", "make", "condition", "owner"],
  organization: ["org_type", "jurisdiction", "role"],
} as const;

export type EntityCategory = keyof typeof ATTRIBUTE_KEYS;
