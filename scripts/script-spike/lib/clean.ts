// Cleaning runs in the source language: the artefacts differ per script, and
// everything downstream anchors to offsets in the cleaned text, so this has to
// be deterministic and reproducible. Nothing here calls a model.

const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F]/;
const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670]/g;
const TATWEEL = /\u0640/g;

/** Bracketed non-speech markers left inline by caption generators. */
const NON_SPEECH = /\[[^\]\n]{1,40}\]|\([^)\n]{0,20}(?:music|applause|laughter)[^)\n]{0,20}\)/gi;

const EN_FILLERS = /\b(?:uh|um|erm|uhh|umm|mm+|hmm+)\b[,]?\s*/gi;

export type Language = "en" | "ar" | "other";

export function detectLanguage(text: string): Language {
  const sample = text.slice(0, 4000);
  const arabic = (sample.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latin = (sample.match(/[A-Za-z]/g) ?? []).length;
  if (arabic > latin) return "ar";
  if (latin > 0) return "en";
  return "other";
}

export function hasArabic(text: string): boolean {
  return ARABIC_RANGE.test(text);
}

function collapse(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanEnglish(text: string): string {
  return collapse(text.replace(NON_SPEECH, " ").replace(EN_FILLERS, ""));
}

/**
 * Conservative on purpose. Letter-form normalisation (alef variants, taa
 * marbuta) changes meaning and is only safe for comparison, so it lives in
 * matchKey() and never touches the stored text.
 */
function cleanArabic(text: string): string {
  return collapse(
    text.replace(NON_SPEECH, " ").replace(ARABIC_DIACRITICS, "").replace(TATWEEL, ""),
  );
}

export function cleanByLanguage(text: string, language: Language): string {
  if (language === "ar") return cleanArabic(text);
  return cleanEnglish(text);
}

/** Comparison-only key: folds the spellings ASR flips between. */
export function matchKey(text: string): string {
  return text
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(/[\u0622\u0623\u0625]/g, "\u0627")
    .replace(/\u0649/g, "\u064a")
    .replace(/\u0629/g, "\u0647")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Sentence split for the translation alignment. Runs after punctuation
 * restoration, so it can rely on terminators existing.
 */
export function splitSentences(text: string): { text: string; start: number; end: number }[] {
  const out: { text: string; start: number; end: number }[] = [];
  const re = /[^.!?\u061F\u06D4\n]+[.!?\u061F\u06D4]*\s*/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const body = m[0];
    if (!body.trim()) continue;
    out.push({ text: body.trim(), start: m.index, end: m.index + body.length });
  }
  return out;
}

/** Word-bounded chunks, for stages that must stay inside a context window. */
export function chunkWords(text: string, size: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size).join(" "));
  }
  return chunks.length ? chunks : [""];
}
