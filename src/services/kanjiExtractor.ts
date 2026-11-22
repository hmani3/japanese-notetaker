import { ExtractedKanjiResult } from '../types';

// CJK Unified Ideographs (Common/Joyo/Jinmeiyo), Extension A, and Compatibility Ideographs
const KANJI_REGEX = /[\u4E00-\u9FAF\u3400-\u4DBF\uF900-\uFAFF]/g;

/**
 * Extracts ONLY Kanji characters from any text, discarding kana, furigana artifacts,
 * punctuation, romaji, and special symbols.
 */
export function extractKanji(text: string): ExtractedKanjiResult {
  if (!text) {
    return { all: [], unique: [], counts: {} };
  }

  const matches = text.match(KANJI_REGEX) || [];
  const counts: Record<string, number> = {};

  for (const k of matches) {
    counts[k] = (counts[k] || 0) + 1;
  }

  // Preserve order of appearance for unique list
  const uniqueSeen = new Set<string>();
  const unique: string[] = [];
  for (const k of matches) {
    if (!uniqueSeen.has(k)) {
      uniqueSeen.add(k);
      unique.push(k);
    }
  }

  return {
    all: matches,
    unique,
    counts,
  };
}
