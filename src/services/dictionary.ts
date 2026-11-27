// @ts-ignore: kanji.js UMD bundle
import Kanji from 'kanji.js';
import { KanjiEntry } from '../types';

interface RawKanjiDetails {
  literal: string;
  meanings?: string[];
  onyomi?: string[];
  kunyomi?: string[];
  jlpt?: number | null;
  stroke_count?: number | null;
  grade?: number | null;
  freq?: number | null;
}

export function lookupKanji(char: string): Omit<KanjiEntry, 'frequency' | 'firstSeen' | 'lastSeen'> {
  let details: RawKanjiDetails | null = null;
  try {
    details = (Kanji.getDetails ? Kanji.getDetails(char) : null) as RawKanjiDetails | null;
  } catch (err) {
    console.warn(`Error looking up kanji ${char}:`, err);
  }

  if (details) {
    return {
      kanji: char,
      meanings: details.meanings || [],
      onyomi: details.onyomi || [],
      kunyomi: details.kunyomi || [],
      jlpt: details.jlpt ?? null,
      strokeCount: details.stroke_count ?? null,
      grade: details.grade ?? null,
      jishoFreq: details.freq ?? null,
    };
  }

  // Fallback for rare kanji not found in KANJIDIC
  return {
    kanji: char,
    meanings: ['(Definition not in offline KANJIDIC)'],
    onyomi: [],
    kunyomi: [],
    jlpt: null,
    strokeCount: null,
    grade: null,
    jishoFreq: null,
  };
}

let cachedAllJishoKanji: KanjiEntry[] | null = null;

/**
 * Returns all 13,108+ KANJIDIC Kanji entries (same dataset backing Jisho's #kanji index),
 * cached in memory after first load for instant in-app browsing and search.
 */
export function getAllJishoKanji(): KanjiEntry[] {
  if (cachedAllJishoKanji) {
    return cachedAllJishoKanji;
  }

  try {
    const rawList: RawKanjiDetails[] = Kanji.dump ? Kanji.dump() : [];
    cachedAllJishoKanji = rawList.map((d) => ({
      kanji: d.literal,
      frequency: 0,
      meanings: d.meanings || [],
      onyomi: d.onyomi || [],
      kunyomi: d.kunyomi || [],
      jlpt: d.jlpt ?? null,
      strokeCount: d.stroke_count ?? null,
      grade: d.grade ?? null,
      jishoFreq: d.freq ?? null,
      firstSeen: '',
      lastSeen: '',
    }));
  } catch (err) {
    console.warn('Error loading full KANJIDIC dump:', err);
    cachedAllJishoKanji = [];
  }

  return cachedAllJishoKanji;
}
