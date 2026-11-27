import React, { useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ExtractedScanData, ScanHistoryRecord } from '../types';
import { deleteHistoryRecord, saveHistory } from '../services/storage';
import { ScanSummaryModal } from './ScanSummaryModal';
import { confirmAction } from '../utils/alerts';

interface HistoryTabProps {
  history: ScanHistoryRecord[];
  onRefresh: () => void;
  onGoToScan: () => void;
}

type HistorySort = 'newest' | 'oldest' | 'most_kanji';

export const HistoryTab: React.FC<HistoryTabProps> = ({
  history,
  onRefresh,
  onGoToScan,
}) => {
  const [sortMode, setSortMode] = useState<HistorySort>('newest');
  const [selectedScan, setSelectedScan] = useState<ScanHistoryRecord | null>(null);

  const sortedHistory = useMemo(() => {
    const list = [...history];
    return list.sort((a, b) => {
      if (sortMode === 'newest') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } else if (sortMode === 'oldest') {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortMode === 'most_kanji') {
        return b.totalKanjiCount - a.totalKanjiCount;
      }
      return 0;
    });
  }, [history, sortMode]);

  const selectedScanData: ExtractedScanData | null = useMemo(() => {
    if (!selectedScan) return null;
    return {
      individual: {
        all: selectedScan.kanjiList || [],
        unique: selectedScan.uniqueKanji || [],
        counts: selectedScan.kanjiCounts || {},
      },
      compounds: selectedScan.compounds || [],
      blurbs: selectedScan.blurbs || [],
      imageUri: selectedScan.imageUri,
      imageAspectRatio: selectedScan.imageAspectRatio,
    };
  }, [selectedScan]);

  const handleDeleteScan = (id: string) => {
    confirmAction('Delete Scan', 'Remove this scan record from your history?', 'Delete', async () => {
      await deleteHistoryRecord(id);
      onRefresh();
      if (selectedScan?.id === id) {
        setSelectedScan(null);
      }
    });
  };

  const handleClearAllHistory = () => {
    confirmAction(
      'Clear History',
      'Delete all previous scan records from history?',
      'Clear All',
      async () => {
        await saveHistory([]);
        onRefresh();
      }
    );
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scan History</Text>
        <Text style={styles.headerSubtitle}>{history.length} recorded sessions</Text>
      </View>

      {/* Sort Bar */}
      <View style={styles.sortBar}>
        <TouchableOpacity
          style={[styles.sortBtn, sortMode === 'newest' && styles.sortBtnActive]}
          onPress={() => setSortMode('newest')}
        >
          <Text style={[styles.sortBtnText, sortMode === 'newest' && styles.sortBtnTextActive]}>
            Newest First
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sortBtn, sortMode === 'oldest' && styles.sortBtnActive]}
          onPress={() => setSortMode('oldest')}
        >
          <Text style={[styles.sortBtnText, sortMode === 'oldest' && styles.sortBtnTextActive]}>
            Oldest First
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sortBtn, sortMode === 'most_kanji' && styles.sortBtnActive]}
          onPress={() => setSortMode('most_kanji')}
        >
          <Text style={[styles.sortBtnText, sortMode === 'most_kanji' && styles.sortBtnTextActive]}>
            Most Kanji
          </Text>
        </TouchableOpacity>
      </View>

      {/* History List */}
      {sortedHistory.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No scan history yet.</Text>
          <TouchableOpacity style={styles.scanBtn} onPress={onGoToScan}>
            <Text style={styles.scanBtnText}>Scan a Page</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sortedHistory}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const previewKanji = item.uniqueKanji.slice(0, 8).join(' ');
            const previewCompounds = item.compounds
              .slice(0, 4)
              .map((c) => c.compound)
              .join(' • ');

            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => setSelectedScan(item)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteScan(item.id)}
                  >
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.cardStats}>
                  <Text style={styles.statTag}>
                    {item.totalKanjiCount} Kanji ({item.uniqueKanjiCount} unique)
                  </Text>
                  <Text style={styles.statTag}>{item.compounds.length} Compounds</Text>
                  {item.blurbs && item.blurbs.length > 0 ? (
                    <Text style={styles.statTag}>{item.blurbs.length} Blurbs</Text>
                  ) : null}
                </View>

                {previewCompounds ? (
                  <Text style={styles.compoundsPreview} numberOfLines={1}>
                    {previewCompounds}
                  </Text>
                ) : null}

                <Text style={styles.kanjiPreview} numberOfLines={1}>
                  {previewKanji}
                </Text>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            <TouchableOpacity style={styles.clearAllBtn} onPress={handleClearAllHistory}>
              <Text style={styles.clearAllBtnText}>Clear All History</Text>
            </TouchableOpacity>
          }
        />
      )}

      {/* Full-featured Scan Details Modal (retains all Kanji meanings, readings, JLPT, Compounds & Translation) */}
      <ScanSummaryModal
        visible={selectedScan !== null}
        scanData={selectedScanData}
        onCancel={() => setSelectedScan(null)}
        isHistory={true}
        title={selectedScan?.label || 'Scan Details'}
        subtitlePrefix={selectedScan ? formatDate(selectedScan.date) : undefined}
        onDelete={selectedScan ? () => handleDeleteScan(selectedScan.id) : undefined}
        kanjiDetailsMap={selectedScan?.kanjiDetails}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111113',
    paddingHorizontal: 16,
  },
  header: {
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8A8A9A',
    marginTop: 2,
  },
  sortBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  sortBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 4,
    backgroundColor: '#1A1A1E',
    borderWidth: 1,
    borderColor: '#26262C',
  },
  sortBtnActive: {
    backgroundColor: '#E05666',
    borderColor: '#E05666',
  },
  sortBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8A8A9A',
  },
  sortBtnTextActive: {
    color: '#FFF',
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#18181C',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#24242A',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardDate: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DDD',
  },
  deleteBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  deleteBtnText: {
    color: '#E05666',
    fontSize: 11,
  },
  cardStats: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  statTag: {
    fontSize: 11,
    color: '#8A8A9A',
  },
  compoundsPreview: {
    fontSize: 13,
    color: '#E05666',
    fontWeight: '600',
    marginBottom: 4,
  },
  kanjiPreview: {
    fontSize: 13,
    color: '#777',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#777',
  },
  scanBtn: {
    backgroundColor: '#26262E',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  scanBtnText: {
    color: '#E05666',
    fontSize: 13,
    fontWeight: 'bold',
  },
  clearAllBtn: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  clearAllBtnText: {
    color: '#E05666',
    fontSize: 12,
  },
});
