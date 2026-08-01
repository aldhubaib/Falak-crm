// Stage 02 — clean, in each source's own language.
//
// Deterministic work first (non-speech markers, diacritics, whitespace), then
// one model pass for punctuation and sentence boundaries, which auto-captions
// never provide and stage 04 needs to align on.
//
// The model is told to re-punctuate and nothing else. A word-count drift guard
// catches the failure where it quietly rewrites the text instead — if that
// happened unnoticed, every downstream offset would point at prose nobody said.
import { MODELS } from "../config";
import {
  cleanByLanguage,
  chunkWords,
  detectLanguage,
  wordCount,
  type Language,
} from "../lib/clean";
import { complete, mapLimit } from "../lib/llm";
import { readStage, writeStage, heading } from "../lib/io";
import type { FetchedSource } from "./01-fetch";

export type CleanedSource = FetchedSource & {
  language: Language;
  cleanedText: string;
  driftPct: number;
};

const CHUNK_WORDS = 900;
const DRIFT_LIMIT = 3;

const SYSTEM = `You restore punctuation in machine-generated transcripts.

Rules, in order of importance:
1. Never add, remove, translate or reorder words. The word sequence must survive exactly.
2. Add sentence terminators, commas and capitalisation (for scripts that have case).
3. Insert a blank line between clear topic shifts.
4. Do not add headings, speaker labels, commentary or summaries.

Return only the punctuated text.`;

async function restorePunctuation(text: string, language: Language): Promise<string> {
  const chunks = chunkWords(text, CHUNK_WORDS);
  const done = await mapLimit(chunks, 4, async (chunk) => {
    if (!chunk.trim()) return chunk;
    const out = await complete(
      MODELS.small,
      `Language: ${language}\n\nTranscript chunk:\n\n${chunk}`,
      { system: SYSTEM, temperature: 0 },
    );
    return out.trim() || chunk;
  });
  return done.join("\n\n");
}

export async function run(): Promise<CleanedSource[]> {
  heading("Stage 02 — clean");

  const sources = readStage<FetchedSource[]>("01-fetch");
  const usable = sources.filter((s) => s.ok && s.rawText.trim());

  const results: CleanedSource[] = [];

  for (const source of usable) {
    const language = detectLanguage(source.rawText);
    const deterministic = cleanByLanguage(source.rawText, language);
    const before = wordCount(deterministic);

    const punctuated = await restorePunctuation(deterministic, language);
    const after = wordCount(punctuated);
    const driftPct = before ? Math.abs(after - before) / before * 100 : 0;

    // Over the limit the rewrite risk outweighs the punctuation benefit.
    const cleanedText = driftPct > DRIFT_LIMIT ? deterministic : punctuated;

    console.log(
      `  ${source.id}  lang=${language}  ${before} words  drift=${driftPct.toFixed(1)}%` +
        (driftPct > DRIFT_LIMIT ? "  REJECTED punctuation pass, kept deterministic clean" : ""),
    );

    results.push({ ...source, language, cleanedText, driftPct });
  }

  writeStage("02-clean", results);
  return results;
}
