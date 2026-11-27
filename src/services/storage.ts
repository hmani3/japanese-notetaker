import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Catalog,
  CompoundsCatalog,
  ExtractedScanData,
  KanjiEntry,
  ScanHistoryRecord,
  ScanStats,
} from '../types';
import { lookupKanji } from './dictionary';

const CATALOG_STORAGE_KEY = '@manga_kanji_catalog_v1';
const COMPOUNDS_STORAGE_KEY = '@manga_kanji_compounds_v1';
const HISTORY_STORAGE_KEY = '@manga_kanji_history_v1';
const STATS_STORAGE_KEY = '@manga_kanji_stats_v1';

export async function loadCatalog(): Promise<Catalog> {
  try {
    const raw = await AsyncStorage.getItem(CATALOG_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Catalog) : {};
  } catch {
    return {};
  }
}

export async function saveCatalog(catalog: Catalog): Promise<void> {
  await AsyncStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog));
}

export async function loadCompoundsCatalog(): Promise<CompoundsCatalog> {
  try {
    const raw = await AsyncStorage.getItem(COMPOUNDS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CompoundsCatalog) : {};
  } catch {
    return {};
  }
}

export async function saveCompoundsCatalog(compounds: CompoundsCatalog): Promise<void> {
  await AsyncStorage.setItem(COMPOUNDS_STORAGE_KEY, JSON.stringify(compounds));
}

export async function loadHistory(): Promise<ScanHistoryRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ScanHistoryRecord[]) : [];
  } catch {
    return [];
  }
}

export async function saveHistory(records: ScanHistoryRecord[]): Promise<void> {
  await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(records));
}

export async function deleteHistoryRecord(id: string): Promise<ScanHistoryRecord[]> {
  const history = await loadHistory();
  const updated = history.filter((item) => item.id !== id);
  await saveHistory(updated);
  return updated;
}

export async function loadStats(): Promise<ScanStats> {
  try {
    const raw = await AsyncStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) {
      return { totalScans: 0, totalKanjiSeen: 0, uniqueKanjiCount: 0, uniqueCompoundsCount: 0 };
    }
    return JSON.parse(raw) as ScanStats;
  } catch {
    return { totalScans: 0, totalKanjiSeen: 0, uniqueKanjiCount: 0, uniqueCompoundsCount: 0 };
  }
}

export async function saveStats(stats: ScanStats): Promise<void> {
  await AsyncStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
}

/**
 * Records newly scanned page data:
 * 1. Updates individual Kanji frequencies & catalog
 * 2. Updates Compound frequencies & catalog
 * 3. Appends a detailed record to Scan History
 * 4. Updates overall Stats
 */
export async function recordScanData(
  scanData: ExtractedScanData,
  label?: string
): Promise<{
  catalog: Catalog;
  compoundsCatalog: CompoundsCatalog;
  history: ScanHistoryRecord[];
  stats: ScanStats;
  newKanjiCount: number;
  updatedKanjiCount: number;
  newCompoundCount: number;
}> {
  const currentCatalog = await loadCatalog();
  const currentCompounds = await loadCompoundsCatalog();
  const currentHistory = await loadHistory();
  const currentStats = await loadStats();
  const now = new Date().toISOString();

  let newKanjiCount = 0;
  let updatedKanjiCount = 0;
  let newCompoundCount = 0;

  // 1. Update individual kanji catalog
  for (const [char, countOnPage] of Object.entries(scanData.individual.counts)) {
    const existing = currentCatalog[char];
    if (existing) {
      existing.frequency += countOnPage;
      existing.lastSeen = now;
      updatedKanjiCount++;
    } else {
      const dictInfo = lookupKanji(char);
      currentCatalog[char] = {
        ...dictInfo,
        frequency: countOnPage,
        firstSeen: now,
        lastSeen: now,
      };
      newKanjiCount++;
    }
  }

  // 2. Update compounds catalog
  for (const item of scanData.compounds) {
    const existing = currentCompounds[item.compound];
    if (existing) {
      existing.frequency += item.countOnPage;
      existing.lastSeen = now;
      if (!existing.reading || existing.reading === '—') {
        existing.reading = item.reading;
      }
      if (!existing.meaning || existing.meaning === 'No definition') {
        existing.meaning = item.meaning;
      }
    } else {
      currentCompounds[item.compound] = {
        compound: item.compound,
        reading: item.reading,
        meaning: item.meaning,
        frequency: item.countOnPage,
        firstSeen: now,
        lastSeen: now,
      };
      newCompoundCount++;
    }
  }

  // 3. Create Scan History record with full Kanji dictionary snapshot
  const kanjiDetails: Record<string, KanjiEntry> = {};
  for (const char of scanData.individual.unique) {
    if (currentCatalog[char]) {
      kanjiDetails[char] = { ...currentCatalog[char] };
    }
  }

  const newRecord: ScanHistoryRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: now,
    label: label || `Scan #${currentHistory.length + 1}`,
    kanjiList: scanData.individual.all,
    uniqueKanji: scanData.individual.unique,
    kanjiCounts: scanData.individual.counts,
    kanjiDetails,
    compounds: scanData.compounds,
    blurbs: scanData.blurbs || [],
    imageUri: scanData.imageUri,
    imageAspectRatio: scanData.imageAspectRatio,
    totalKanjiCount: scanData.individual.all.length,
    uniqueKanjiCount: scanData.individual.unique.length,
  };

  const updatedHistory = [newRecord, ...currentHistory];

  // 4. Update stats
  const updatedStats: ScanStats = {
    totalScans: currentStats.totalScans + 1,
    totalKanjiSeen: currentStats.totalKanjiSeen + scanData.individual.all.length,
    uniqueKanjiCount: Object.keys(currentCatalog).length,
    uniqueCompoundsCount: Object.keys(currentCompounds).length,
  };

  await saveCatalog(currentCatalog);
  await saveCompoundsCatalog(currentCompounds);
  try {
    await saveHistory(updatedHistory);
  } catch {
    // Web localStorage has ~5MB limit; strip older images first, then current image if needed
    const trimmed = updatedHistory.map((rec, idx) =>
      idx === 0 ? rec : { ...rec, imageUri: undefined }
    );
    try {
      await saveHistory(trimmed);
    } catch {
      const noImages = updatedHistory.map((rec) => ({ ...rec, imageUri: undefined }));
      await saveHistory(noImages);
    }
  }
  await saveStats(updatedStats);

  return {
    catalog: currentCatalog,
    compoundsCatalog: currentCompounds,
    history: updatedHistory,
    stats: updatedStats,
    newKanjiCount,
    updatedKanjiCount,
    newCompoundCount,
  };
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove([
    CATALOG_STORAGE_KEY,
    COMPOUNDS_STORAGE_KEY,
    HISTORY_STORAGE_KEY,
    STATS_STORAGE_KEY,
  ]);
}
