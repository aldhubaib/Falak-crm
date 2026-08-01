// Stage 05 — extract the fact layer.
//
// Two shapes, because they compare differently:
//   attributes — a typed property of one entity (age, occupation, colour)
//   events     — something that happened, with a time, a place and participants
//
// Both carry normalised values alongside the prose, so stage 06 can compare
// structured payloads instead of guessing whether two sentences disagree.
// "17 years old" and "aged 17" reduce to the same number and stop being a
// conflict without anyone having to look at them.
//
// Attribute keys come from a fixed vocabulary. Left free, a model emits "age",
// "years old" and "Age" as three keys, and the group-by in stage 06 then finds
// no conflicts at all — a failure that looks exactly like success.
import { ATTRIBUTE_KEYS, MODELS } from "../config";
import { completeJson, mapLimit } from "../lib/llm";
import { readStage, writeStage, heading } from "../lib/io";
import type { Entity } from "./03-entities";
import type { PivotSource } from "./04-translate";

export type FactValue =
  | { kind: "text"; s: string }
  | { kind: "number"; n: number; unit?: string }
  | { kind: "date"; iso: string }
  | { kind: "range"; from: string; to: string };

export type Attribute = {
  id: string;
  entityId: string;
  key: string;
  value: FactValue;
  claim: string;
  sourceId: string;
  sentenceIndices: number[];
};

export type EventFact = {
  id: string;
  summary: string;
  timeKind: "exact" | "range" | "relative" | "unknown";
  timeValue: FactValue | null;
  locationId: string | null;
  participants: { entityId: string; role: string }[];
  sourceId: string;
  sentenceIndices: number[];
};

const SYSTEM = `You extract a structured fact layer from transcript sentences.

You receive numbered sentences in Modern Standard Arabic. Tokens like ⟦E12⟧ are
entity references — use the token id, never the surrounding words, to identify
who or what a fact is about.

Return JSON:
{
  "attributes": [{
    "entityId": "E12",
    "key": "<one of the allowed keys for that entity's category>",
    "value": { "kind": "text"|"number"|"date"|"range", ... },
    "claim": "<short Arabic sentence stating the fact>",
    "sentenceIndices": [number]
  }],
  "events": [{
    "summary": "<short Arabic sentence: what happened>",
    "timeKind": "exact"|"range"|"relative"|"unknown",
    "timeValue": { "kind": "date", "iso": "YYYY-MM-DD" } | { "kind":"range", "from":"YYYY", "to":"YYYY" } | null,
    "locationId": "E7" | null,
    "participants": [{ "entityId": "E12", "role": "actor"|"target"|"witness"|"discoverer" }],
    "sentenceIndices": [number]
  }]
}

Value rules:
- Numbers as { "kind": "number", "n": 17, "unit": "years" } — never as text.
- Full dates as { "kind": "date", "iso": "1983-06-13" }. Partial dates use the range kind.
- Only use "text" when the fact genuinely is not quantifiable.

Hard rules:
- Extract ONLY what the sentences state. Never infer, complete or draw on outside knowledge. An invented fact is the worst possible output.
- Every fact must list the sentence indices it came from.
- Skip narration, commentary and speculation by the presenter. Facts only.
- Return only JSON.`;

const WINDOW = 40;

export async function run(): Promise<{ attributes: Attribute[]; events: EventFact[] }> {
  heading("Stage 05 — facts");

  const pivots = readStage<PivotSource[]>("04-translate");
  const entities = readStage<Entity[]>("03-entities");

  const categoryById = new Map(entities.map((e) => [e.id, e.category]));
  const roster = entities
    .map((e) => `${e.id} = ${e.canonical} (${e.category})`)
    .join("\n");
  const keyList = Object.entries(ATTRIBUTE_KEYS)
    .map(([cat, keys]) => `${cat}: ${keys.join(", ")}`)
    .join("\n");

  const attributes: Attribute[] = [];
  const events: EventFact[] = [];
  let attrSeq = 0;
  let eventSeq = 0;
  let droppedKeys = 0;
  let droppedEntities = 0;

  for (const pivot of pivots) {
    const windows: AlignedWindow[] = [];
    for (let i = 0; i < pivot.sentences.length; i += WINDOW) {
      windows.push({ start: i, sentences: pivot.sentences.slice(i, i + WINDOW) });
    }

    const extracted = await mapLimit(windows, 3, async (win) => {
      const numbered = win.sentences
        .map((s) => `[${s.index}] ${s.pivot}`)
        .join("\n");
      return completeJson<{ attributes?: RawAttribute[]; events?: RawEvent[] }>(
        MODELS.extract,
        `Entities:\n${roster}\n\nAllowed attribute keys by category:\n${keyList}\n\nSentences:\n${numbered}`,
        { system: SYSTEM, temperature: 0 },
      );
    });

    for (const batch of extracted) {
      for (const a of batch.attributes ?? []) {
        const category = categoryById.get(a.entityId);
        if (!category) {
          droppedEntities++;
          continue;
        }
        const allowed = ATTRIBUTE_KEYS[category] as readonly string[];
        if (!allowed.includes(a.key)) {
          droppedKeys++;
          continue;
        }
        attributes.push({
          id: `A${++attrSeq}`,
          entityId: a.entityId,
          key: a.key,
          value: a.value,
          claim: a.claim,
          sourceId: pivot.sourceId,
          sentenceIndices: a.sentenceIndices ?? [],
        });
      }

      for (const e of batch.events ?? []) {
        events.push({
          id: `V${++eventSeq}`,
          summary: e.summary,
          timeKind: e.timeKind ?? "unknown",
          timeValue: e.timeValue ?? null,
          locationId: e.locationId ?? null,
          participants: (e.participants ?? []).filter((p) => categoryById.has(p.entityId)),
          sourceId: pivot.sourceId,
          sentenceIndices: e.sentenceIndices ?? [],
        });
      }
    }

    console.log(
      `  ${pivot.sourceId}  ${attributes.filter((a) => a.sourceId === pivot.sourceId).length} attributes, ` +
        `${events.filter((v) => v.sourceId === pivot.sourceId).length} events`,
    );
  }

  if (droppedKeys || droppedEntities) {
    console.log(
      `  dropped ${droppedKeys} off-vocabulary keys and ${droppedEntities} unknown entity refs` +
        " — if either number is large, widen ATTRIBUTE_KEYS rather than ignoring it",
    );
  }

  const unsourced = [...attributes, ...events].filter((f) => !f.sentenceIndices.length).length;
  if (unsourced) {
    console.log(`  ${unsourced} facts arrived with no sentence reference — they cannot be verified`);
  }

  writeStage("05-facts", { attributes, events });
  return { attributes, events };
}

type AlignedWindow = { start: number; sentences: PivotSource["sentences"] };
type RawAttribute = {
  entityId: string;
  key: string;
  value: FactValue;
  claim: string;
  sentenceIndices?: number[];
};
type RawEvent = {
  summary: string;
  timeKind?: EventFact["timeKind"];
  timeValue?: FactValue | null;
  locationId?: string | null;
  participants?: { entityId: string; role: string }[];
  sentenceIndices?: number[];
};
