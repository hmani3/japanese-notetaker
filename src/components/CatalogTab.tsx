import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Catalog, CompoundEntry, CompoundsCatalog, KanjiEntry, ScanStats } from '../types';
import { KanjiCard } from './KanjiCard';
import { KanjiDetailModal } from './KanjiDetailModal';
import { DrawKanjiModal } from './DrawKanjiModal';
import { clearAllData } from '../services/storage';

interface CatalogTabProps {
  catalog: Catalog;
  compoundsCatalog: CompoundsCatalog;
  stats: ScanStats;
  onRefresh: () => void;
  onGoToScan: () => void;
}

type CatalogViewMode = 'individual' | 'compounds';
type SortMode = 'frequency' | 'recent' | 'jlpt_or_length' | 'resemblance';

export const CatalogTab: React.FC<CatalogTabProps> = ({
  catalog,
  compoundsCatalog,
  stats,
  onRefresh,
  onGoToScan,
}) => {
  const [viewMode, setViewMode] = useState<CatalogViewMode>('individual');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('frequency');
  const [selectedKanji, setSelectedKanji] = useState<KanjiEntry | null>(null);
  const [resemblanceOrder, setResemblanceOrder] = useState<string[]>([]);
  const [showDrawModal, setShowDrawModal] = useState(false);

  const catalogKanjiList = useMemo(() => Object.keys(catalog), [catalog]);

  // 1. Filtered & Sorted Individual Kanji
  const kanjiEntries = useMemo(() => {
    let list = Object.values(catalog);

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((item) => {
        if (item.kanji.includes(q)) return true;
        if (item.meanings.some((m) => m.toLowerCase().includes(q))) return true;
        if (item.onyomi.some((o) => o.toLowerCase().includes(q))) return true;
        if (item.kunyomi.some((k) => k.toLowerCase().includes(q))) return true;
        return false;
      });
    }

    return list.sort((a, b) => {
      if (sortMode === 'resemblance' && resemblanceOrder.length > 0) {
        const indexA = resemblanceOrder.indexOf(a.kanji);
        const indexB = resemblanceOrder.indexOf(b.kanji);
        const rankA = indexA !== -1 ? indexA : 9999;
        const rankB = indexB !== -1 ? indexB : 9999;
        if (rankA !== rankB) return rankA - rankB;
        return b.frequency - a.frequency;
      } else if (sortMode === 'frequency') {
        return b.frequency - a.frequency;
      } else if (sortMode === 'recent') {
        return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
      } else if (sortMode === 'jlpt_or_length') {
        const jlptA = a.jlpt ?? 99;
        const jlptB = b.jlpt ?? 99;
        return jlptA - jlptB;
      }
      return 0;
    });
  }, [catalog, searchQuery, sortMode, resemblanceOrder]);

  // 2. Filtered & Sorted Compounds
  const compoundEntries = useMemo(() => {
    let list = Object.values(compoundsCatalog);

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((item) => {
        if (item.compound.includes(q)) return true;
        if (item.meaning.toLowerCase().includes(q)) return true;
        if (item.reading.toLowerCase().includes(q)) return true;
        return false;
      });
    }

    return list.sort((a, b) => {
      if (sortMode === 'frequency') {
        return b.frequency - a.frequency;
      } else if (sortMode === 'recent') {
        return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
      } else if (sortMode === 'jlpt_or_length') {
        return b.compound.length - a.compound.length;
      }
      return 0;
    });
  }, [compoundsCatalog, searchQuery, sortMode]);

  const handleClear = () => {
    Alert.alert('Clear Catalog', 'Reset all recorded Kanji, compounds, and history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          await clearAllData();
          onRefresh();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Minimal Header Stats */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Catalog</Text>
        <Text style={styles.headerStats}>
          {stats.uniqueKanjiCount} unique Kanji • {stats.uniqueCompoundsCount || 0} unique Compounds
        </Text>
      </View>

      {/* Mode Toggle: Individual vs Compounds */}
      <View style={styles.viewModeToggle}>
        <TouchableOpacity
          style={[styles.modeBtn, viewMode === 'individual' && styles.modeBtnActive]}
          onPress={() => setViewMode('individual')}
        >
          <Text style={[styles.modeBtnText, viewMode === 'individual' && styles.modeBtnTextActive]}>
            Individual Kanji ({stats.uniqueKanjiCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeBtn, viewMode === 'compounds' && styles.modeBtnActive]}
          onPress={() => setViewMode('compounds')}
        >
          <Text style={[styles.modeBtnText, viewMode === 'compounds' && styles.modeBtnTextActive]}>
            Compounds ({stats.uniqueCompoundsCount || 0})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Input Row with Draw Search Button */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder={
            viewMode === 'individual'
              ? 'Filter by Kanji, meaning, or reading...'
              : 'Filter compounds, readings, or meanings...'
          }
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {viewMode === 'individual' && (
          <TouchableOpacity
            style={[
              styles.drawBtn,
              resemblanceOrder.length > 0 && styles.drawBtnActive,
            ]}
            onPress={() => setShowDrawModal(true)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.drawBtnText,
                resemblanceOrder.length > 0 && styles.drawBtnTextActive,
              ]}
            >
              Draw
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Resemblance Active Banner */}
      {resemblanceOrder.length > 0 && viewMode === 'individual' && (
        <View style={styles.resemblanceBar}>
          <View style={styles.resemblanceBarLeft}>
            <Text style={styles.resemblanceBarTitle}>Sorted by Resemblance</Text>
            <Text style={styles.resemblanceBarSub} numberOfLines={1}>
              Drawing matches: {resemblanceOrder.slice(0, 6).join(' ')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.resemblanceClearBtn}
            onPress={() => {
              setResemblanceOrder([]);
              setSortMode('frequency');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.resemblanceClearBtnText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Sort Buttons */}
      <View style={styles.sortRow}>
        {resemblanceOrder.length > 0 && viewMode === 'individual' && (
          <TouchableOpacity
            style={[styles.sortBtn, sortMode === 'resemblance' && styles.sortBtnActive]}
            onPress={() => setSortMode('resemblance')}
          >
            <Text
              style={[styles.sortBtnText, sortMode === 'resemblance' && styles.sortBtnTextActive]}
            >
              Resemblance
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.sortBtn, sortMode === 'frequency' && styles.sortBtnActive]}
          onPress={() => setSortMode('frequency')}
        >
          <Text style={[styles.sortBtnText, sortMode === 'frequency' && styles.sortBtnTextActive]}>
            Frequency
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sortBtn, sortMode === 'recent' && styles.sortBtnActive]}
          onPress={() => setSortMode('recent')}
        >
          <Text style={[styles.sortBtnText, sortMode === 'recent' && styles.sortBtnTextActive]}>
            Recent
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sortBtn, sortMode === 'jlpt_or_length' && styles.sortBtnActive]}
          onPress={() => setSortMode('jlpt_or_length')}
        >
          <Text
            style={[styles.sortBtnText, sortMode === 'jlpt_or_length' && styles.sortBtnTextActive]}
          >
            {viewMode === 'individual' ? 'JLPT' : 'Length'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* List Content */}
      {viewMode === 'individual' ? (
        kanjiEntries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No matching Kanji.' : 'No Kanji catalogued yet.'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity style={styles.scanBtn} onPress={onGoToScan}>
                <Text style={styles.scanBtnText}>Go to Scan</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={kanjiEntries}
            keyExtractor={(item) => item.kanji}
            renderItem={({ item }) => {
              const rank = resemblanceOrder.indexOf(item.kanji);
              const resemblanceRank =
                sortMode === 'resemblance' && rank !== -1 ? rank + 1 : undefined;
              return (
                <KanjiCard
                  entry={item}
                  resemblanceRank={resemblanceRank}
                  onPress={() => setSelectedKanji(item)}
                />
              );
            }}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
                <Text style={styles.clearBtnText}>Reset All Data</Text>
              </TouchableOpacity>
            }
          />
        )
      ) : compoundEntries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchQuery ? 'No matching Compounds.' : 'No Compounds catalogued yet.'}
          </Text>
          {!searchQuery && (
            <TouchableOpacity style={styles.scanBtn} onPress={onGoToScan}>
              <Text style={styles.scanBtnText}>Go to Scan</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={compoundEntries}
          keyExtractor={(item) => item.compound}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }: { item: CompoundEntry }) => (
            <View style={styles.compoundCard}>
              <View style={styles.compoundLeft}>
                <Text style={styles.compoundWord}>{item.compound}</Text>
                <Text style={styles.compoundReading}>{item.reading}</Text>
              </View>
              <View style={styles.compoundCenter}>
                <Text style={styles.compoundMeaning} numberOfLines={2}>
                  {item.meaning}
                </Text>
              </View>
              <Text style={styles.compoundCount}>{item.frequency}×</Text>
            </View>
          )}
          ListFooterComponent={
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
              <Text style={styles.clearBtnText}>Reset All Data</Text>
            </TouchableOpacity>
          }
        />
      )}

      {/* Detail Modal */}
      <KanjiDetailModal
        entry={selectedKanji}
        visible={selectedKanji !== null}
        onClose={() => setSelectedKanji(null)}
      />

      {/* Draw Kanji Search Modal */}
      <DrawKanjiModal
        visible={showDrawModal}
        catalogKanji={catalogKanjiList}
        onSelectMatch={(char) => {
          setSearchQuery(char);
          setResemblanceOrder([char]);
          setSortMode('resemblance');
        }}
        onApplyResemblanceOrder={(candidates) => {
          setResemblanceOrder(candidates);
          setSortMode('resemblance');
          setSearchQuery('');
        }}
        onClose={() => setShowDrawModal(false)}
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
  headerStats: {
    fontSize: 12,
    color: '#8A8A9A',
    marginTop: 2,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#1E1E24',
    borderRadius: 8,
    padding: 3,
    marginBottom: 8,
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
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#18181C',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#26262C',
  },
  drawBtn: {
    backgroundColor: '#202028',
    borderRadius: 6,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30303C',
  },
  drawBtnActive: {
    backgroundColor: '#E05666',
    borderColor: '#E05666',
  },
  drawBtnText: {
    color: '#DDD',
    fontSize: 12,
    fontWeight: '700',
  },
  drawBtnTextActive: {
    color: '#FFF',
  },
  resemblanceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#26161A',
    borderWidth: 1,
    borderColor: '#E05666',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  resemblanceBarLeft: {
    flex: 1,
    marginRight: 8,
  },
  resemblanceBarTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFF',
  },
  resemblanceBarSub: {
    fontSize: 10,
    color: '#E05666',
    marginTop: 1,
  },
  resemblanceClearBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#E05666',
    borderRadius: 4,
  },
  resemblanceClearBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  sortBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
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
    fontSize: 12,
    color: '#8A8A9A',
    fontWeight: '600',
  },
  sortBtnTextActive: {
    color: '#FFF',
  },
  listContent: {
    paddingBottom: 20,
  },
  compoundCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181C',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#24242A',
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
  },
  compoundMeaning: {
    fontSize: 13,
    color: '#EEE',
  },
  compoundCount: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#E05666',
    marginLeft: 8,
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
  clearBtn: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  clearBtnText: {
    color: '#E05666',
    fontSize: 12,
  },
});
