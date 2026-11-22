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
  };
}
