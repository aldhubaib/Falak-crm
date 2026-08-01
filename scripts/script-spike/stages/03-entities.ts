// Stage 03 — entities, extracted BEFORE translation.
//
// Caption ASR spells the same name several ways within one transcript. Cluster
// those variants here, while the text is still in its original script: if you
// translate first, each source transliterates independently and the noise gets
// amplified into false conflicts instead of collapsed.
//
// The canonical ids assigned here are pinned through translation (stage 04) so
// every source refers to a person by the same token.
import { MODELS } from "../config";
import { chunkWords, matchKey } from "../lib/clean";
import { completeJson, mapLimit } from "../lib/llm";
import { readStage, writeStage, heading } from "../lib/io";
import type { CleanedSource } from "./02-clean";

export type Entity = {
  id: string;
  category: "person" | "location" | "prop" | "organization";
  canonical: string;
  aliases: string[];
  sourceIds: string[];
};

type RawMention = { name: string; category: Entity["category"] };

const EXTRACT_SYSTEM = `You extract named entities from a transcript chunk.

Return JSON: { "entities": [{ "name": string, "category": "person" | "location" | "prop" | "organization" }] }

- "prop" means a concrete physical object that matters to the story (a weapon, a vehicle, a piece of jewellery, a document).
- Record each distinct surface spelling you see, even when two look like the same name misspelt. Clustering happens later.
- Skip generic nouns and roles that name nobody in particular.
- Return only JSON.`;

const CLUSTER_SYSTEM = `You merge spelling variants of the same real-world entity.

You receive a list of surface names with categories, extracted from imperfect
speech-to-text. The same person or place is often spelt several ways.

Return JSON: { "clusters": [{ "canonical": string, "category": string, "aliases": string[] }] }

- Merge only variants of the SAME entity. Two different people with similar names must stay separate — a wrong merge destroys facts and is far worse than a missed one.
- "canonical" is the best-attested, most complete spelling; include it in aliases too.
- Every input name must appear in exactly one cluster.
- Return only JSON.`;

export async function run(): Promise<Entity[]> {
  heading("Stage 03 — entities");

  const sources = readStage<CleanedSource[]>("02-clean");

  const perSource = await mapLimit(sources, 2, async (source) => {
    const chunks = chunkWords(source.cleanedText, 1500);
    const found = await mapLimit(chunks, 3, async (chunk) => {
      if (!chunk.trim()) return [] as RawMention[];
      const json = await completeJson<{ entities?: RawMention[] }>(
        MODELS.extract,
        chunk,
        { system: EXTRACT_SYSTEM, temperature: 0 },
      );
      return json.entities ?? [];
    });
    return { sourceId: source.id, mentions: found.flat() };
  });

  // Fold exact duplicates before the clustering call — it keeps the prompt
  // small and the model's job to genuine variants only.
  const bySurface = new Map<string, { name: string; category: Entity["category"]; sourceIds: Set<string> }>();
  for (const { sourceId, mentions } of perSource) {
    for (const m of mentions) {
      if (!m?.name?.trim()) continue;
      const key = `${m.category}::${matchKey(m.name)}`;
      const prev = bySurface.get(key);
      if (prev) prev.sourceIds.add(sourceId);
      else bySurface.set(key, { name: m.name.trim(), category: m.category, sourceIds: new Set([sourceId]) });
    }
  }

  const surfaces = [...bySurface.values()];
  console.log(`  ${surfaces.length} distinct surface names across ${sources.length} sources`);

  const { clusters = [] } = await completeJson<{
    clusters?: { canonical: string; category: Entity["category"]; aliases: string[] }[];
  }>(
    MODELS.extract,
    JSON.stringify(surfaces.map((s) => ({ name: s.name, category: s.category }))),
    { system: CLUSTER_SYSTEM, temperature: 0 },
  );

  const entities: Entity[] = clusters.map((c, i) => {
    const aliases = [...new Set([c.canonical, ...(c.aliases ?? [])].filter(Boolean))];
    const sourceIds = new Set<string>();
    for (const alias of aliases) {
      const hit = bySurface.get(`${c.category}::${matchKey(alias)}`);
      hit?.sourceIds.forEach((id) => sourceIds.add(id));
    }
    return {
      id: `E${i + 1}`,
      category: c.category,
      canonical: c.canonical,
      aliases,
      sourceIds: [...sourceIds],
    };
  });

  const merged = entities.filter((e) => e.aliases.length > 1);
  console.log(`  ${entities.length} entities, ${merged.length} of them merged from variants`);
  for (const e of merged) {
    console.log(`    ${e.id} ${e.canonical}  ←  ${e.aliases.join(" | ")}`);
  }
  console.log("  Check these merges by hand — a wrong merge is worse than a missed one.");

  writeStage("03-entities", entities);
  return entities;
}
