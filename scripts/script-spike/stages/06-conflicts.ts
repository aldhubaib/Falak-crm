// Stage 06 — find the conflicts.
//
// Attribute conflicts are a GROUP BY, not a model call: same entity, same key,
// different normalised value. Deterministic, free, reproducible.
//
// Events need clustering first — one source says the body was found, another
// says hunters discovered remains. Comparing every pair with a model is O(n²)
// and would dominate the bill, so embeddings shortlist the candidates and a
// model only confirms the survivors.
//
// Conflicts are typed, because only one of the four kinds is a decision for a
// human. If the review queue fills with precision differences and spelling
// noise, the writer stops reading it.
import { MODELS } from "../config";
import { cosine, completeJson, embed, mapLimit } from "../lib/llm";
import { readStage, writeStage, heading } from "../lib/io";
import type { Entity } from "./03-entities";
import type { Attribute, EventFact, FactValue } from "./05-facts";

export type Conflict = {
  id: string;
  kind: "contradiction" | "precision" | "single_source" | "sequence";
  subject: string;
  options: { factIds: string[]; sourceIds: string[]; statement: string }[];
  /** Highest source trustLevel among the options, as a starting suggestion. */
  suggested?: string[];
};

const SIMILARITY_THRESHOLD = 0.82;

function valueKey(v: FactValue | null): string {
  if (!v) return "∅";
  switch (v.kind) {
    case "number":
      return `n:${v.n}${v.unit ? `:${v.unit}` : ""}`;
    case "date":
      return `d:${v.iso}`;
    case "range":
      return `r:${v.from}..${v.to}`;
    default:
      return `t:${v.s.trim().toLowerCase()}`;
  }
}

/** A range that contains the other value is looser, not contradictory. */
function isPrecisionPair(a: FactValue | null, b: FactValue | null): boolean {
  if (!a || !b) return true;
  if (a.kind === "range" && b.kind === "date") return b.iso >= a.from && b.iso <= a.to;
  if (b.kind === "range" && a.kind === "date") return a.iso >= b.from && a.iso <= b.to;
  if (a.kind === "date" && b.kind === "date") {
    // Same year stated at different precision.
    return a.iso.slice(0, 4) === b.iso.slice(0, 4) && a.iso !== b.iso;
  }
  return false;
}

const CLUSTER_SYSTEM = `You decide whether two descriptions refer to the same real-world event.

Return JSON: { "same": boolean, "confidence": number }

Same event means the same occurrence at the same time and place, described
differently. Two similar occurrences on different dates, or two separate
discoveries, are NOT the same event.

Return only JSON.`;

export async function run(): Promise<Conflict[]> {
  heading("Stage 06 — conflicts");

  const { attributes, events } = readStage<{ attributes: Attribute[]; events: EventFact[] }>(
    "05-facts",
  );
  const entities = readStage<Entity[]>("03-entities");
  const sources = readStage<{ id: string; trustLevel: number }[]>("01-fetch");

  const nameById = new Map(entities.map((e) => [e.id, e.canonical]));
  const trustById = new Map(sources.map((s) => [s.id, s.trustLevel ?? 2]));
  const conflicts: Conflict[] = [];
  let seq = 0;

  // ── Attributes: pure group-by ────────────────────────────────────────────
  const groups = new Map<string, Attribute[]>();
  for (const a of attributes) {
    const key = `${a.entityId}::${a.key}`;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }

  for (const [key, group] of groups) {
    const [entityId, attrKey] = key.split("::");
    const subject = `${nameById.get(entityId) ?? entityId} — ${attrKey}`;
    const byValue = new Map<string, Attribute[]>();
    for (const a of group) {
      const vk = valueKey(a.value);
      byValue.set(vk, [...(byValue.get(vk) ?? []), a]);
    }

    if (byValue.size === 1) {
      const only = [...byValue.values()][0];
      const distinctSources = new Set(only.map((a) => a.sourceId));
      if (distinctSources.size === 1) {
        conflicts.push({
          id: `C${++seq}`,
          kind: "single_source",
          subject,
          options: [
            {
              factIds: only.map((a) => a.id),
              sourceIds: [...distinctSources],
              statement: only[0].claim,
            },
          ],
        });
      }
      continue;
    }

    const options = [...byValue.entries()].map(([, items]) => ({
      factIds: items.map((a) => a.id),
      sourceIds: [...new Set(items.map((a) => a.sourceId))],
      statement: items[0].claim,
    }));

    const values = [...byValue.values()].map((items) => items[0].value);
    const allPrecision = values.every((v, i) =>
      values.every((w, j) => i === j || isPrecisionPair(v, w)),
    );

    conflicts.push({
      id: `C${++seq}`,
      kind: allPrecision ? "precision" : "contradiction",
      subject,
      options,
      suggested: pickByTrust(options, trustById),
    });
  }

  // ── Events: embed, shortlist, confirm ────────────────────────────────────
  if (events.length > 1) {
    const vectors = await embed(events.map((e) => e.summary), MODELS.embed);

    const candidates: [number, number][] = [];
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        if (events[i].sourceId === events[j].sourceId) continue;
        if (cosine(vectors[i], vectors[j]) >= SIMILARITY_THRESHOLD) candidates.push([i, j]);
      }
    }
    const pairTotal = (events.length * (events.length - 1)) / 2;
    console.log(
      `  ${candidates.length} candidate event pairs shortlisted from ${pairTotal} (${MODELS.embed})`,
    );

    const confirmed = await mapLimit(candidates, 4, async ([i, j]) => {
      const { same } = await completeJson<{ same?: boolean }>(
        MODELS.extract,
        JSON.stringify({ a: events[i].summary, b: events[j].summary }),
        { system: CLUSTER_SYSTEM, temperature: 0 },
      );
      return same ? ([i, j] as const) : null;
    });

    // Union-find over the confirmed pairs.
    const parent = events.map((_, i) => i);
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    for (const pair of confirmed) {
      if (!pair) continue;
      parent[find(pair[0])] = find(pair[1]);
    }

    const clusters = new Map<number, number[]>();
    events.forEach((_, i) => {
      const root = find(i);
      clusters.set(root, [...(clusters.get(root) ?? []), i]);
    });

    for (const members of clusters.values()) {
      if (members.length < 2) continue;
      const group = members.map((i) => events[i]);
      const subject = group[0].summary;

      const byTime = new Map<string, EventFact[]>();
      for (const e of group) {
        const tk = valueKey(e.timeValue);
        byTime.set(tk, [...(byTime.get(tk) ?? []), e]);
      }
      if (byTime.size > 1) {
        const options = [...byTime.values()].map((items) => ({
          factIds: items.map((e) => e.id),
          sourceIds: [...new Set(items.map((e) => e.sourceId))],
          statement: `${items[0].summary} — ${valueKey(items[0].timeValue)}`,
        }));
        const times = [...byTime.values()].map((items) => items[0].timeValue);
        const allPrecision = times.every((v, i) =>
          times.every((w, j) => i === j || isPrecisionPair(v, w)),
        );
        conflicts.push({
          id: `C${++seq}`,
          kind: allPrecision ? "precision" : "contradiction",
          subject: `when: ${subject}`,
          options,
          suggested: pickByTrust(options, trustById),
        });
      }

      const byPlace = new Map<string, EventFact[]>();
      for (const e of group) {
        const pk = e.locationId ?? "∅";
        byPlace.set(pk, [...(byPlace.get(pk) ?? []), e]);
      }
      const realPlaces = [...byPlace.keys()].filter((k) => k !== "∅");
      if (realPlaces.length > 1) {
        conflicts.push({
          id: `C${++seq}`,
          kind: "contradiction",
          subject: `where: ${subject}`,
          options: realPlaces.map((k) => {
            const items = byPlace.get(k)!;
            return {
              factIds: items.map((e) => e.id),
              sourceIds: [...new Set(items.map((e) => e.sourceId))],
              statement: `${nameById.get(k) ?? k}`,
            };
          }),
        });
      }
    }
  }

  const byKind = conflicts.reduce<Record<string, number>>((acc, c) => {
    acc[c.kind] = (acc[c.kind] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`  ${conflicts.length} total:`, byKind);
  const decisions = conflicts.filter((c) => c.kind === "contradiction").length;
  console.log(
    `  ${decisions} need a human decision; the rest are informational.`,
  );
  console.log("  Score the noise ratio by hand — that is the go/no-go for the review UI.");

  writeStage("06-conflicts", conflicts);
  return conflicts;
}

function pickByTrust(
  options: Conflict["options"],
  trustById: Map<string, number>,
): string[] | undefined {
  let best: { score: number; factIds: string[] } | null = null;
  for (const o of options) {
    const score = Math.max(...o.sourceIds.map((id) => trustById.get(id) ?? 2));
    if (!best || score > best.score) best = { score, factIds: o.factIds };
  }
  return best?.factIds;
}
