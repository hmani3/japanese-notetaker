import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { ScanHistoryRecord } from '../types';
import { deleteHistoryRecord, saveHistory } from '../services/storage';

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
  const [detailViewMode, setDetailViewMode] = useState<'individual' | 'compounds' | 'blurbs'>(
    'compounds'
  );

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

  const handleDeleteScan = (id: string) => {
    Alert.alert('Delete Scan', 'Remove this scan record from your history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteHistoryRecord(id);
          onRefresh();
          if (selectedScan?.id === id) {
            setSelectedScan(null);
          }
        },
      },
    ]);
  };

  const handleClearAllHistory = () => {
    Alert.alert('Clear History', 'Delete all previous scan records from history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          await saveHistory([]);
          onRefresh();
        },
      },
    ]);
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

      {/* Detail Modal for Selected Scan */}
      <Modal
        visible={selectedScan !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedScan(null)}
      >
        <View style={styles.modalRoot}>
          <TouchableWithoutFeedback onPress={() => setSelectedScan(null)}>
            <View style={styles.backdropOverlay} />
          </TouchableWithoutFeedback>

          <View style={styles.sheet}>
            {selectedScan && (
              <>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Scan Details</Text>
                  <Text style={styles.sheetSubtitle}>{formatDate(selectedScan.date)}</Text>
                </View>

                {/* Toggle: Compounds vs Kanji vs Translation & Notes */}
                <View style={styles.viewModeToggle}>
                  <TouchableOpacity
                    style={[
                      styles.modeBtn,
                      detailViewMode === 'compounds' && styles.modeBtnActive,
                    ]}
                    onPress={() => setDetailViewMode('compounds')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.modeBtnText,
                        detailViewMode === 'compounds' && styles.modeBtnTextActive,
                      ]}
                    >
                      Compounds ({selectedScan.compounds.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modeBtn,
                      detailViewMode === 'individual' && styles.modeBtnActive,
                    ]}
                    onPress={() => setDetailViewMode('individual')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.modeBtnText,
                        detailViewMode === 'individual' && styles.modeBtnTextActive,
                      ]}
                    >
                      Kanji ({selectedScan.uniqueKanjiCount})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modeBtn,
                      detailViewMode === 'blurbs' && styles.modeBtnActive,
                    ]}
                    onPress={() => setDetailViewMode('blurbs')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.modeBtnText,
                        detailViewMode === 'blurbs' && styles.modeBtnTextActive,
                      ]}
                    >
                      Translation ({selectedScan.blurbs ? selectedScan.blurbs.length : 0})
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Scrollable Content */}
                {detailViewMode === 'compounds' ? (
                  <FlatList
                    style={styles.detailFlatList}
                    data={selectedScan.compounds}
                    keyExtractor={(item) => item.compound}
                    contentContainerStyle={styles.detailList}
                    showsVerticalScrollIndicator={true}
                    renderItem={({ item }) => (
                      <View style={styles.detailRow}>
                        <View style={styles.compoundCol}>
                          <Text style={styles.compoundText}>{item.compound}</Text>
                          <Text style={styles.compoundReading}>{item.reading}</Text>
                        </View>
                        <Text style={styles.detailMeaning} numberOfLines={2}>
                          {item.meaning}
                        </Text>
                        <Text style={styles.detailCount}>{item.countOnPage}×</Text>
                      </View>
                    )}
                  />
                ) : detailViewMode === 'individual' ? (
                  <FlatList
                    style={styles.detailFlatList}
                    data={selectedScan.uniqueKanji}
                    keyExtractor={(char) => char}
                    contentContainerStyle={styles.detailList}
                    showsVerticalScrollIndicator={true}
                    renderItem={({ item: char }) => {
                      const count = selectedScan.kanjiCounts[char] || 1;
                      return (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailKanjiChar}>{char}</Text>
                          <View style={styles.detailKanjiSpacer} />
                          <Text style={styles.detailCount}>{count}×</Text>
                        </View>
                      );
                    }}
                  />
                ) : (
                  <FlatList
                    style={styles.detailFlatList}
                    data={selectedScan.blurbs || []}
                    keyExtractor={(item, index) => `history-blurb-${item.orderIndex ?? index}`}
                    contentContainerStyle={styles.detailList}
                    showsVerticalScrollIndicator={true}
                    ListEmptyComponent={
                      <View style={styles.emptyBlurbs}>
                        <Text style={styles.emptyBlurbsText}>
                          No dialogue or translation recorded for this scan.
                        </Text>
                      </View>
                    }
                    renderItem={({ item, index }) => (
                      <View style={styles.blurbCard}>
                        <View style={styles.blurbHeader}>
                          <Text style={styles.blurbIndexBadge}>Bubble #{index + 1}</Text>
                        </View>
                        <Text style={styles.blurbJapanese}>{item.japanese}</Text>
                        <Text style={styles.blurbTranslation}>{item.translation}</Text>
                        {item.notes ? (
                          <View style={styles.blurbNotesBox}>
                            <Text style={styles.blurbNotesLabel}>NUANCES & CONTEXT</Text>
                            <Text style={styles.blurbNotesText}>{item.notes}</Text>
                          </View>
                        ) : null}
                      </View>
                    )}
                  />
                )}

                <View style={styles.sheetFooter}>
                  <TouchableOpacity
                    style={styles.sheetDeleteBtn}
                    onPress={() => handleDeleteScan(selectedScan.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.sheetDeleteText}>Delete Scan</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.sheetCloseBtn}
                    onPress={() => setSelectedScan(null)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.sheetCloseText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdropOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  detailFlatList: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#16161A',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    height: '85%',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: '#26262E',
  },
  sheetHeader: {
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  sheetSubtitle: {
    fontSize: 12,
    color: '#8A8A9A',
    marginTop: 2,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#1E1E24',
    borderRadius: 8,
    padding: 3,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A2A34',
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
  },
  modeBtnActive: {
    backgroundColor: '#2A2A36',
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8A9A',
  },
  modeBtnTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  detailList: {
    paddingBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E24',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#26262E',
  },
  compoundCol: {
    minWidth: 80,
    marginRight: 10,
  },
  compoundText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  compoundReading: {
    fontSize: 11,
    color: '#E05666',
    marginTop: 2,
  },
  detailMeaning: {
    flex: 1,
    fontSize: 13,
    color: '#DDD',
  },
  detailCount: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#E05666',
    marginLeft: 8,
  },
  detailKanjiChar: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  detailKanjiSpacer: {
    flex: 1,
  },
  sheetFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#202026',
  },
  sheetDeleteBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#26262E',
    alignItems: 'center',
  },
  sheetDeleteText: {
    color: '#E05666',
    fontSize: 13,
    fontWeight: '600',
  },
  sheetCloseBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#33333E',
    alignItems: 'center',
  },
  sheetCloseText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  blurbCard: {
    backgroundColor: '#1E1E24',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#26262E',
    gap: 8,
  },
  blurbHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  blurbIndexBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8A8A9A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  blurbJapanese: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    lineHeight: 22,
  },
  blurbTranslation: {
    fontSize: 14,
    color: '#EEE',
    lineHeight: 20,
  },
  blurbNotesBox: {
    backgroundColor: '#16161A',
    borderRadius: 6,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#E05666',
    marginTop: 2,
    gap: 4,
  },
  blurbNotesLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#E05666',
    letterSpacing: 0.8,
  },
  blurbNotesText: {
    fontSize: 12,
    color: '#A5A5B8',
    lineHeight: 18,
  },
  emptyBlurbs: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  emptyBlurbsText: {
    color: '#777',
    fontSize: 13,
  },
});
