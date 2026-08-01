// Cleaning runs in the source's own language: caption artefacts differ per
// script, and everything downstream anchors to offsets in the cleaned text, so
// this stays deterministic. No model calls here.

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670]/g;
const TATWEEL = /\u0640/g;

/** Bracketed non-speech markers caption generators leave inline. */
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

function collapse(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Conservative for Arabic on purpose: letter-form folding (alef variants, taa
 * marbuta) changes meaning, so it belongs in matchKey() for comparisons and
 * never in the stored text.
 */
export function cleanText(text: string, language: Language): string {
  const withoutMarkers = text.replace(NON_SPEECH, " ");
  if (language === "ar") {
    return collapse(withoutMarkers.replace(ARABIC_DIACRITICS, "").replace(TATWEEL, ""));
  }
  return collapse(withoutMarkers.replace(EN_FILLERS, ""));
}

/** Comparison-only key that folds the spellings ASR flips between. */
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
