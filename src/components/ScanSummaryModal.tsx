import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { ExtractedScanData, KanjiEntry, ScannedCompoundItem } from '../types';
import { lookupKanji } from '../services/dictionary';
import { KanjiDetailModal } from './KanjiDetailModal';

interface ScanSummaryModalProps {
  visible: boolean;
  scanData: ExtractedScanData | null;
  onSave?: () => void;
  onCancel: () => void;
  isHistory?: boolean;
  title?: string;
  subtitlePrefix?: string;
  onDelete?: () => void;
  kanjiDetailsMap?: Record<string, KanjiEntry>;
}

type ViewMode = 'individual' | 'compounds' | 'blurbs' | 'page';
type KanjiSortMode = 'order' | 'frequency' | 'difficulty';
type CompoundSortMode = 'order' | 'frequency' | 'length';

interface ScannedKanjiItem {
  kanji: string;
  countOnPage: number;
  orderIndex: number;
  meanings: string[];
  onyomi: string[];
  kunyomi: string[];
  jlpt: number | null;
  strokeCount: number | null;
  grade: number | null;
  jishoFreq?: number | null;
}

export const ScanSummaryModal: React.FC<ScanSummaryModalProps> = ({
  visible,
  scanData,
  onSave,
  onCancel,
  isHistory = false,
  title,
  subtitlePrefix,
  onDelete,
  kanjiDetailsMap,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('individual');
  const [kanjiSort, setKanjiSort] = useState<KanjiSortMode>('order');
  const [compoundSort, setCompoundSort] = useState<CompoundSortMode>('order');
  const [detailEntry, setDetailEntry] = useState<KanjiEntry | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [selectedBlurbIdx, setSelectedBlurbIdx] = useState<number | null>(null);

  // 1. Processed Individual Kanji List
  const kanjiItems = useMemo(() => {
    if (!scanData) return [];

    const list: ScannedKanjiItem[] = scanData.individual.unique.map((char, index) => {
      const saved = kanjiDetailsMap?.[char];
      const details = saved || lookupKanji(char);
      return {
        kanji: char,
        countOnPage: scanData.individual.counts[char] || 1,
        orderIndex: index,
        meanings: details.meanings,
        onyomi: details.onyomi,
        kunyomi: details.kunyomi,
        jlpt: details.jlpt,
        strokeCount: details.strokeCount,
        grade: details.grade,
        jishoFreq: details.jishoFreq ?? null,
      };
    });

    return list.sort((a, b) => {
      if (kanjiSort === 'order') {
        return a.orderIndex - b.orderIndex;
      } else if (kanjiSort === 'frequency') {
        if (b.countOnPage !== a.countOnPage) return b.countOnPage - a.countOnPage;
        return a.orderIndex - b.orderIndex;
      } else if (kanjiSort === 'difficulty') {
        const rankA = a.jlpt !== null ? a.jlpt : 0;
        const rankB = b.jlpt !== null ? b.jlpt : 0;
        if (rankA !== rankB) return rankA - rankB;
        return (b.strokeCount || 0) - (a.strokeCount || 0);
      }
      return 0;
    });
  }, [scanData, kanjiSort, kanjiDetailsMap]);

  // 2. Processed Compounds List
  const compoundItems = useMemo(() => {
    if (!scanData) return [];

    const list: ScannedCompoundItem[] = [...scanData.compounds];

    return list.sort((a, b) => {
      if (compoundSort === 'order') {
        return a.orderIndex - b.orderIndex;
      } else if (compoundSort === 'frequency') {
        if (b.countOnPage !== a.countOnPage) return b.countOnPage - a.countOnPage;
        return a.orderIndex - b.orderIndex;
      } else if (compoundSort === 'length') {
        return b.compound.length - a.compound.length;
      }
      return 0;
    });
  }, [scanData, compoundSort]);

  if (!scanData) return null;

  const handleOpenDetail = (item: ScannedKanjiItem) => {
    const saved = kanjiDetailsMap?.[item.kanji];
    setDetailEntry({
      kanji: item.kanji,
      frequency: saved ? saved.frequency : item.countOnPage,
      meanings: item.meanings,
      onyomi: item.onyomi,
      kunyomi: item.kunyomi,
      jlpt: item.jlpt,
      strokeCount: item.strokeCount,
      grade: item.grade,
      jishoFreq: item.jishoFreq ?? null,
      firstSeen: saved?.firstSeen || new Date().toISOString(),
      lastSeen: saved?.lastSeen || new Date().toISOString(),
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.modalRoot}>
        {/* Backdrop overlay that dismisses on tap */}
        <TouchableWithoutFeedback onPress={onCancel}>
          <View style={styles.backdropOverlay} />
        </TouchableWithoutFeedback>

        {/* Foreground Sheet (Not wrapped in Pressable so FlatList receives all scroll events) */}
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title || (isHistory ? 'Scan Details' : 'Scanned Page')}</Text>
            <Text style={styles.subtitle}>
              {subtitlePrefix ? `${subtitlePrefix} • ` : ''}
              {scanData.individual.all.length} Kanji ({scanData.individual.unique.length} unique) •{' '}
              {scanData.compounds.length} Compounds
              {scanData.blurbs && scanData.blurbs.length > 0
                ? ` • ${scanData.blurbs.length} Blurbs`
                : ''}
            </Text>
          </View>

          {/* Mode Toggle: Individual Kanji vs Compounds vs Translation & Notes */}
          <View style={styles.viewModeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, viewMode === 'individual' && styles.modeBtnActive]}
              onPress={() => setViewMode('individual')}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.modeBtnText, viewMode === 'individual' && styles.modeBtnTextActive]}
              >
                Kanji ({scanData.individual.unique.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeBtn, viewMode === 'compounds' && styles.modeBtnActive]}
              onPress={() => setViewMode('compounds')}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.modeBtnText, viewMode === 'compounds' && styles.modeBtnTextActive]}
              >
                Compounds ({scanData.compounds.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeBtn, viewMode === 'blurbs' && styles.modeBtnActive]}
              onPress={() => setViewMode('blurbs')}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.modeBtnText, viewMode === 'blurbs' && styles.modeBtnTextActive]}
              >
                Translation ({scanData.blurbs ? scanData.blurbs.length : 0})
              </Text>
            </TouchableOpacity>

            {scanData.imageUri ? (
              <TouchableOpacity
                style={[styles.modeBtn, viewMode === 'page' && styles.modeBtnActive]}
                onPress={() => setViewMode('page')}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.modeBtnText, viewMode === 'page' && styles.modeBtnTextActive]}
                >
                  Page
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Sort & Order Controls */}
          {viewMode === 'individual' ? (
            <View style={styles.sortBar}>
              <TouchableOpacity
                style={[styles.sortBtn, kanjiSort === 'order' && styles.sortBtnActive]}
                onPress={() => setKanjiSort('order')}
              >
                <Text style={[styles.sortBtnText, kanjiSort === 'order' && styles.sortBtnTextActive]}>
                  Order (R→L)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortBtn, kanjiSort === 'frequency' && styles.sortBtnActive]}
                onPress={() => setKanjiSort('frequency')}
              >
                <Text
                  style={[styles.sortBtnText, kanjiSort === 'frequency' && styles.sortBtnTextActive]}
                >
                  Frequency
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortBtn, kanjiSort === 'difficulty' && styles.sortBtnActive]}
                onPress={() => setKanjiSort('difficulty')}
              >
                <Text
                  style={[styles.sortBtnText, kanjiSort === 'difficulty' && styles.sortBtnTextActive]}
                >
                  Difficulty
                </Text>
              </TouchableOpacity>
            </View>
          ) : viewMode === 'compounds' ? (
            <View style={styles.sortBar}>
              <TouchableOpacity
                style={[styles.sortBtn, compoundSort === 'order' && styles.sortBtnActive]}
                onPress={() => setCompoundSort('order')}
              >
                <Text
                  style={[styles.sortBtnText, compoundSort === 'order' && styles.sortBtnTextActive]}
                >
                  Order (R→L)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortBtn, compoundSort === 'frequency' && styles.sortBtnActive]}
                onPress={() => setCompoundSort('frequency')}
              >
                <Text
                  style={[
                    styles.sortBtnText,
                    compoundSort === 'frequency' && styles.sortBtnTextActive,
                  ]}
                >
                  Frequency
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortBtn, compoundSort === 'length' && styles.sortBtnActive]}
                onPress={() => setCompoundSort('length')}
              >
                <Text
                  style={[styles.sortBtnText, compoundSort === 'length' && styles.sortBtnTextActive]}
                >
                  Length
                </Text>
              </TouchableOpacity>
            </View>
          ) : viewMode === 'blurbs' ? (
            <View style={styles.blurbHintBar}>
              <Text style={styles.blurbHintText}>Reading Order: Right → Left, Top → Bottom</Text>
            </View>
          ) : (
            <View style={styles.overlayControlRow}>
              <Text style={styles.blurbHintText}>Tap any bubble to inspect full notes</Text>
              <TouchableOpacity
                style={[styles.overlayToggleBtn, showOverlay && styles.overlayToggleBtnActive]}
                onPress={() => setShowOverlay((prev) => !prev)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.overlayToggleText,
                    showOverlay && styles.overlayToggleTextActive,
                  ]}
                >
                  {showOverlay ? 'Overlay: ON' : 'Original'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Fully Scrollable List with flex: 1 */}
          {viewMode === 'individual' ? (
            <FlatList
              style={styles.scrollList}
              data={kanjiItems}
              keyExtractor={(item) => item.kanji}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const meaningPreview = item.meanings.slice(0, 2).join(', ');
                const readingsPreview = [
                  ...(item.onyomi.slice(0, 1) || []),
                  ...(item.kunyomi.slice(0, 1) || []),
                ].join(' / ');

                return (
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => handleOpenDetail(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.kanjiChar}>{item.kanji}</Text>
                    <View style={styles.infoCol}>
                      <Text style={styles.meaningText} numberOfLines={1}>
                        {meaningPreview || 'No definition'}
                      </Text>
                      <Text style={styles.readingText} numberOfLines={1}>
                        {readingsPreview || '—'}
                      </Text>
                    </View>
                    <View style={styles.metaCol}>
                      <Text style={styles.countText}>{item.countOnPage}×</Text>
                      {item.jlpt !== null ? (
                        <Text style={styles.tagText}>N{item.jlpt}</Text>
                      ) : item.strokeCount !== null ? (
                        <Text style={styles.tagText}>{item.strokeCount}s</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          ) : viewMode === 'compounds' ? (
            <FlatList
              style={styles.scrollList}
              data={compoundItems}
              keyExtractor={(item) => item.compound}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <View style={styles.compoundLeft}>
                    <Text style={styles.compoundWord}>{item.compound}</Text>
                    <Text style={styles.compoundReading}>{item.reading}</Text>
                  </View>
                  <View style={styles.compoundCenter}>
                    <Text style={styles.meaningText} numberOfLines={2}>
                      {item.meaning}
                    </Text>
                  </View>
                  <View style={styles.metaCol}>
                    <Text style={styles.countText}>{item.countOnPage}×</Text>
                  </View>
                </View>
              )}
            />
          ) : viewMode === 'blurbs' ? (
            <FlatList
              style={styles.scrollList}
              data={scanData.blurbs || []}
              keyExtractor={(item, index) => `blurb-${item.orderIndex ?? index}`}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyBlurbs}>
                  <Text style={styles.emptyBlurbsText}>
                    No speech bubbles or dialogue detected on this page.
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
          ) : (
            <ScrollView
              style={styles.scrollList}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={true}
            >
              {scanData.imageUri ? (
                <View
                  style={[
                    styles.pageCanvas,
                    { aspectRatio: scanData.imageAspectRatio || 0.7 },
                  ]}
                >
                  <Image
                    source={{ uri: scanData.imageUri }}
                    style={styles.pageImage}
                    resizeMode="contain"
                  />

                  {showOverlay ? <View style={styles.pageDimScrim} pointerEvents="none" /> : null}

                  {showOverlay &&
                    (scanData.blurbs || []).map((blurb, idx) => {
                      if (!blurb.box) return null;
                      const [ymin, xmin, ymax, xmax] = blurb.box;
                      const topPct = Math.max(0, Math.min(90, ymin / 10));
                      const leftPct = Math.max(0, Math.min(82, xmin / 10));
                      const widthPct = Math.max(16, Math.min(98 - leftPct, (xmax - xmin) / 10));
                      const minHeightPct = Math.max(7, Math.min(98 - topPct, (ymax - ymin) / 10));
                      const isSelected = selectedBlurbIdx === idx;

                      return (
                        <TouchableOpacity
                          key={`overlay-${blurb.orderIndex ?? idx}`}
                          style={[
                            styles.overlayBubble,
                            {
                              top: `${topPct}%`,
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              minHeight: `${minHeightPct}%`,
                            },
                            isSelected && styles.overlayBubbleSelected,
                          ]}
                          onPress={() =>
                            setSelectedBlurbIdx((prev) => (prev === idx ? null : idx))
                          }
                          activeOpacity={0.85}
                        >
                          <Text style={styles.overlayBubbleNum}>#{idx + 1}</Text>
                          <Text style={styles.overlayBubbleText} numberOfLines={4}>
                            {blurb.translation}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </View>
              ) : (
                <View style={styles.emptyBlurbs}>
                  <Text style={styles.emptyBlurbsText}>
                    Original image not available for this scan.
                  </Text>
                </View>
              )}

              {selectedBlurbIdx !== null && scanData.blurbs?.[selectedBlurbIdx] ? (
                <View style={[styles.blurbCard, { marginTop: 10 }]}>
                  <View style={styles.blurbHeader}>
                    <Text style={styles.blurbIndexBadge}>
                      Selected Bubble #{selectedBlurbIdx + 1}
                    </Text>
                  </View>
                  <Text style={styles.blurbJapanese}>
                    {scanData.blurbs[selectedBlurbIdx].japanese}
                  </Text>
                  <Text style={styles.blurbTranslation}>
                    {scanData.blurbs[selectedBlurbIdx].translation}
                  </Text>
                  {scanData.blurbs[selectedBlurbIdx].notes ? (
                    <View style={styles.blurbNotesBox}>
                      <Text style={styles.blurbNotesLabel}>NUANCES & CONTEXT</Text>
                      <Text style={styles.blurbNotesText}>
                        {scanData.blurbs[selectedBlurbIdx].notes}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </ScrollView>
          )}

          {/* Action Footer */}
          {isHistory ? (
            <View style={styles.footer}>
              {onDelete ? (
                <TouchableOpacity style={styles.discardBtn} onPress={onDelete} activeOpacity={0.7}>
                  <Text style={styles.discardBtnText}>Delete Scan</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: '#33333E' }]}
                onPress={onCancel}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.footer}>
              <TouchableOpacity style={styles.discardBtn} onPress={onCancel} activeOpacity={0.7}>
                <Text style={styles.discardBtnText}>Discard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => onSave?.()}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnText}>Save to Catalog & History</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <KanjiDetailModal
        entry={detailEntry}
        visible={detailEntry !== null}
        onClose={() => setDetailEntry(null)}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
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
  sheet: {
    backgroundColor: '#16161A',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    height: '86%',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: '#26262E',
  },
  header: {
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  subtitle: {
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
  sortBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  sortBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: '#202026',
    borderWidth: 1,
    borderColor: '#2C2C36',
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
  blurbHintBar: {
    backgroundColor: '#1B1B22',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#282834',
    alignItems: 'center',
  },
  blurbHintText: {
    fontSize: 11,
    color: '#8A8A9A',
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
  scrollList: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16,
  },
  row: {
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
  kanjiChar: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF',
    width: 36,
    textAlign: 'center',
    marginRight: 10,
  },
  compoundLeft: {
    minWidth: 80,
    marginRight: 10,
  },
  compoundWord: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFF',
  },
  compoundReading: {
    fontSize: 11,
    color: '#E05666',
    marginTop: 2,
  },
  compoundCenter: {
    flex: 1,
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  meaningText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EEE',
  },
  readingText: {
    fontSize: 11,
    color: '#8A8A9A',
    marginTop: 2,
  },
  metaCol: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  countText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#E05666',
  },
  tagText: {
    fontSize: 10,
    color: '#88A0D0',
    fontWeight: '600',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#202026',
  },
  discardBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    backgroundColor: '#26262E',
    alignItems: 'center',
  },
  discardBtnText: {
    color: '#AAA',
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 6,
    backgroundColor: '#E05666',
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  overlayControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  overlayToggleBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#1E1E24',
    borderWidth: 1,
    borderColor: '#2A2A34',
  },
  overlayToggleBtnActive: {
    backgroundColor: '#28171C',
    borderColor: '#E05666',
  },
  overlayToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A8A9A',
  },
  overlayToggleTextActive: {
    color: '#E05666',
  },
  pageCanvas: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#0E0E12',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#26262E',
  },
  pageImage: {
    width: '100%',
    height: '100%',
  },
  pageDimScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 10, 14, 0.48)',
  },
  overlayBubble: {
    position: 'absolute',
    backgroundColor: 'rgba(18, 18, 24, 0.9)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3A3A4A',
    padding: 4,
    justifyContent: 'center',
  },
  overlayBubbleSelected: {
    borderColor: '#E05666',
    borderWidth: 1.5,
    backgroundColor: 'rgba(30, 18, 24, 0.96)',
  },
  overlayBubbleNum: {
    fontSize: 9,
    fontWeight: '800',
    color: '#E05666',
    marginBottom: 1,
  },
  overlayBubbleText: {
    fontSize: 10,
    lineHeight: 13,
    color: '#FFF',
    fontWeight: '500',
  },
});
