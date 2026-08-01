// Stage 04 — translate to an MSA pivot, sentence-aligned.
//
// Facts have to live in one language to be comparable, but a fact that can no
// longer point at the sentence it came from is not evidence. So translation is
// done sentence by sentence and the mapping back to offsets in the cleaned
// original is kept — the reviewer reads Arabic, the citation resolves to the
// source.
//
// Entity mentions are replaced with pinned tokens first, so the same person is
// literally the same string in every translated source and the transliteration
// decision is deferred to stage 07, where it is made once.
//
// MSA, not Kuwaiti: dialect is a style applied to the final script only. A
// fact layer written in dialect produces register mismatches between sources
// that read as conflicts but are not.
import { MODELS } from "../config";
import { splitSentences } from "../lib/clean";
import { completeJson, mapLimit } from "../lib/llm";
import { readStage, writeStage, heading } from "../lib/io";
import type { CleanedSource } from "./02-clean";
import type { Entity } from "./03-entities";

export type AlignedSentence = {
  index: number;
  pivot: string;
  /** Offsets into the source's cleanedText. */
  cleanStart: number;
  cleanEnd: number;
  /** Video position, when the fetch stage returned timed cues. */
  timeSec?: number;
};

export type PivotSource = {
  sourceId: string;
  language: string;
  translated: boolean;
  sentences: AlignedSentence[];
};

const BATCH = 20;

const SYSTEM = `You translate transcript sentences into Modern Standard Arabic.

Input is a JSON array of sentences. Output JSON: { "translations": string[] }

Absolute rules:
1. The output array must have EXACTLY the same length as the input, in the same order. One translation per input sentence, even when a sentence is fragmentary.
2. Tokens shaped like ⟦E12⟧ are entity placeholders. Copy them through verbatim, in the position the Arabic sentence needs them. Never translate, transliterate, expand or drop them.
3. Translate into plain Modern Standard Arabic. No dialect, no embellishment, no summarising.
4. Preserve numbers, dates and quantities exactly.

Return only JSON.`;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replace every alias of every entity with its pinned token. */
function pinEntities(text: string, entities: Entity[]): string {
  const pairs = entities
    .flatMap((e) => e.aliases.map((alias) => ({ alias, id: e.id })))
    .filter((p) => p.alias.trim().length > 1)
    // Longest first, so "Robert Hansen" wins over "Hansen".
    .sort((a, b) => b.alias.length - a.alias.length);

  let out = text;
  for (const { alias, id } of pairs) {
    const re = new RegExp(
      `(^|[^\\p{L}\\p{N}])(${escapeRegex(alias)})(?=[^\\p{L}\\p{N}]|$)`,
      "giu",
    );
    out = out.replace(re, `$1⟦${id}⟧`);
  }
  return out;
}

/**
 * Cue timings are per segment, not per sentence. Map a sentence to the cue
 * covering its start by walking the running character count of the cues.
 */
function buildTimeLookup(
  segments: { text: string; startSec: number }[] | undefined,
  cleanedLength: number,
  rawLength: number,
): (offset: number) => number | undefined {
  if (!segments?.length || !rawLength) return () => undefined;
  const scale = cleanedLength / rawLength;
  const marks: { at: number; sec: number }[] = [];
  let cursor = 0;
  for (const seg of segments) {
    marks.push({ at: cursor * scale, sec: seg.startSec });
    cursor += seg.text.length + 1;
  }
  return (offset: number) => {
    let lo = 0;
    let hi = marks.length - 1;
    let best: number | undefined;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (marks[mid].at <= offset) {
        best = marks[mid].sec;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best;
  };
}

async function translateBatch(batch: string[]): Promise<string[]> {
  const json = await completeJson<{ translations?: string[] }>(
    MODELS.extract,
    JSON.stringify(batch),
    { system: SYSTEM, temperature: 0 },
  );
  const out = json.translations ?? [];
  if (out.length === batch.length) return out;

  // Alignment is the whole point of this stage; fall back to one call per
  // sentence rather than shipping a mapping that is silently off by one.
  console.log(`    misaligned batch (${out.length}/${batch.length}) — retrying per sentence`);
  return mapLimit(batch, 4, async (sentence) => {
    const single = await completeJson<{ translations?: string[] }>(
      MODELS.extract,
      JSON.stringify([sentence]),
      { system: SYSTEM, temperature: 0 },
    );
    return single.translations?.[0] ?? sentence;
  });
}

export async function run(): Promise<PivotSource[]> {
  heading("Stage 04 — translate to MSA pivot");

  const sources = readStage<CleanedSource[]>("02-clean");
  const entities = readStage<Entity[]>("03-entities");

  const results: PivotSource[] = [];

  for (const source of sources) {
    const pinned = pinEntities(source.cleanedText, entities);
    const sentences = splitSentences(pinned);
    const timeAt = buildTimeLookup(
      source.segments,
      source.cleanedText.length,
      source.rawText.length,
    );

    // Already Arabic: pin entities, skip the translation call entirely.
    if (source.language === "ar") {
      results.push({
        sourceId: source.id,
        language: source.language,
        translated: false,
        sentences: sentences.map((s, i) => ({
          index: i,
          pivot: s.text,
          cleanStart: s.start,
          cleanEnd: s.end,
          timeSec: timeAt(s.start),
        })),
      });
      console.log(`  ${source.id}  ${sentences.length} sentences  (already Arabic, skipped)`);
      continue;
    }

    const batches: typeof sentences[] = [];
    for (let i = 0; i < sentences.length; i += BATCH) {
      batches.push(sentences.slice(i, i + BATCH));
    }

    const translated = await mapLimit(batches, 3, async (batch) =>
      translateBatch(batch.map((s) => s.text)),
    );
    const flat = translated.flat();

    results.push({
      sourceId: source.id,
      language: source.language,
      translated: true,
      sentences: sentences.map((s, i) => ({
        index: i,
        pivot: flat[i] ?? s.text,
        cleanStart: s.start,
        cleanEnd: s.end,
        timeSec: timeAt(s.start),
      })),
    });

    const timed = sentences.filter((s) => timeAt(s.start) !== undefined).length;
    console.log(
      `  ${source.id}  ${sentences.length} sentences translated, ${timed} with a video timestamp`,
    );
  }

  writeStage("04-translate", results);
  return results;
}
