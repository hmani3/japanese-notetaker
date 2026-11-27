export interface KanjiEntry {
  kanji: string;
  frequency: number; // How many times detected across all scans (0 if only from Jisho)
  meanings: string[];
  onyomi: string[];
  kunyomi: string[];
  jlpt: number | null;
  strokeCount: number | null;
  grade: number | null;
  jishoFreq?: number | null; // Newspaper frequency rank from KANJIDIC (1 = most common)
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
  /** Normalized bounding box [ymin, xmin, ymax, xmax] on a 0-1000 scale */
  box?: [number, number, number, number];
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
  imageUri?: string;
  imageAspectRatio?: number;
}

export interface ScanHistoryRecord {
  id: string;
  date: string; // ISO string
  label?: string; // Optional user tag
  kanjiList: string[]; // all kanji in order
  uniqueKanji: string[];
  kanjiCounts: Record<string, number>;
  kanjiDetails?: Record<string, KanjiEntry>; // Full dictionary snapshot for every kanji in the scan
  compounds: ScannedCompoundItem[];
  blurbs?: DialogueBlurb[];
  imageUri?: string;
  imageAspectRatio?: number;
  totalKanjiCount: number;
  uniqueKanjiCount: number;
}
