export interface KanjiEntry {
  kanji: string;
  frequency: number; // How many times detected across all scans
  meanings: string[];
  onyomi: string[];
  kunyomi: string[];
  jlpt: number | null;
  strokeCount: number | null;
  grade: number | null;
  firstSeen: string; // ISO 8601 string
  lastSeen: string; // ISO 8601 string
}

export interface CompoundEntry {
  compound: string;
  reading: string; // in hiragana
  meaning: string;
  frequency: number; // How many times seen across all scans
  firstSeen: string;
  lastSeen: string;
}

export type Catalog = Record<string, KanjiEntry>;
export type CompoundsCatalog = Record<string, CompoundEntry>;

export interface ScanStats {
  totalScans: number;
  totalKanjiSeen: number;
  uniqueKanjiCount: number;
  uniqueCompoundsCount: number;
}

export interface ScannedCompoundItem {
  compound: string;
  reading: string;
  meaning: string;
  countOnPage: number;
  orderIndex: number;
}

export interface DialogueBlurb {
  orderIndex: number;
  japanese: string;
  translation: string;
  notes: string;
}

export interface ExtractedKanjiResult {
  all: string[];
  unique: string[];
  counts: Record<string, number>;
}

export interface ExtractedScanData {
  individual: ExtractedKanjiResult;
  compounds: ScannedCompoundItem[];
  blurbs: DialogueBlurb[];
}

export interface ScanHistoryRecord {
  id: string;
  date: string; // ISO string
  label?: string; // Optional user tag
  kanjiList: string[]; // all kanji in order
  uniqueKanji: string[];
  kanjiCounts: Record<string, number>;
  compounds: ScannedCompoundItem[];
  blurbs?: DialogueBlurb[];
  totalKanjiCount: number;
  uniqueKanjiCount: number;
}
