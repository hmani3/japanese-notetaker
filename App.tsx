import React, { useEffect, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScanTab } from './src/components/ScanTab';
import { CatalogTab } from './src/components/CatalogTab';
import { HistoryTab } from './src/components/HistoryTab';
import { ApiKeyModal } from './src/components/ApiKeyModal';
import {
  loadCatalog,
  loadCompoundsCatalog,
  loadHistory,
  loadStats,
} from './src/services/storage';
import {
  Catalog,
  CompoundsCatalog,
  ExtractedScanData,
  ScanHistoryRecord,
  ScanStats,
} from './src/types';

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

function MainApp() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'scan' | 'catalog' | 'history'>('scan');
  const [catalog, setCatalog] = useState<Catalog>({});
  const [compoundsCatalog, setCompoundsCatalog] = useState<CompoundsCatalog>({});
  const [history, setHistory] = useState<ScanHistoryRecord[]>([]);
  const [stats, setStats] = useState<ScanStats>({
    totalScans: 0,
    totalKanjiSeen: 0,
    uniqueKanjiCount: 0,
    uniqueCompoundsCount: 0,
  });

  // Background scanning & persistent summary state
  const [isScanning, setIsScanning] = useState(false);
  const [scanData, setScanData] = useState<ExtractedScanData | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);

  const refreshData = async () => {
    const loadedCatalog = await loadCatalog();
    const loadedCompounds = await loadCompoundsCatalog();
    const loadedHistory = await loadHistory();
    const loadedStats = await loadStats();
    setCatalog(loadedCatalog);
    setCompoundsCatalog(loadedCompounds);
    setHistory(loadedHistory);
    setStats(loadedStats);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const loadedCatalog = await loadCatalog();
      const loadedCompounds = await loadCompoundsCatalog();
      const loadedHistory = await loadHistory();
      const loadedStats = await loadStats();
      if (mounted) {
        setCatalog(loadedCatalog);
        setCompoundsCatalog(loadedCompounds);
        setHistory(loadedHistory);
        setStats(loadedStats);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleScanRecorded = () => {
    refreshData();
    setActiveTab('catalog');
  };

  const handleTabPress = (tab: 'scan' | 'catalog' | 'history') => {
    setActiveTab(tab);
    if (tab === 'scan') {
      if (scanData && !isScanning) {
        setShowSummary(true);
      }
    } else {
      refreshData();
    }
  };

  const isWeb = Platform.OS === 'web';
  const isStandalonePWA =
    isWeb &&
    typeof window !== 'undefined' &&
    (Boolean((window.navigator as any)?.standalone) ||
      Boolean(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches));

  return (
    <SafeAreaView
      style={styles.container}
      edges={isWeb ? ['left', 'right'] : ['top', 'left', 'right']}
    >
      <StatusBar style="light" />

      {/* Clean Brand Header with Kanji Logo */}
      <View
        style={[
          styles.header,
          isStandalonePWA && { paddingTop: Math.max(insets.top, 24) },
        ]}
      >
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>漫画漢字</Text>
          </View>
          <View style={styles.titleCol}>
            <Text style={styles.appTitle}>Manga Kanji</Text>
            <Text style={styles.appSubtitle}>Reading Companion</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.keyBtn}
            onPress={() => setShowKeyModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.keyBtnText}>Key</Text>
          </TouchableOpacity>

          <View style={styles.statsPill}>
            <Text style={styles.statsPillNum}>{stats.uniqueKanjiCount}</Text>
            <Text style={styles.statsPillLabel}>Kanji</Text>
          </View>
        </View>
      </View>

      {/* Main Content with Persistent Tabs */}
      <View style={styles.body}>
        <View style={[styles.tabView, activeTab !== 'scan' && styles.tabHidden]}>
          <ScanTab
            onScanRecorded={handleScanRecorded}
            isScanning={isScanning}
            setIsScanning={setIsScanning}
            scanData={scanData}
            setScanData={setScanData}
            showSummary={showSummary}
            setShowSummary={setShowSummary}
            isCurrentTab={activeTab === 'scan'}
          />
        </View>

        <View style={[styles.tabView, activeTab !== 'catalog' && styles.tabHidden]}>
          <CatalogTab
            catalog={catalog}
            compoundsCatalog={compoundsCatalog}
            stats={stats}
            onRefresh={refreshData}
            onGoToScan={() => handleTabPress('scan')}
          />
        </View>

        <View style={[styles.tabView, activeTab !== 'history' && styles.tabHidden]}>
          <HistoryTab
            history={history}
            onRefresh={refreshData}
            onGoToScan={() => handleTabPress('scan')}
          />
        </View>
      </View>

      {/* Clean Minimal Bottom Nav with Safe Insets & Multi-line Status */}
      <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'scan' && styles.navItemActive]}
          onPress={() => handleTabPress('scan')}
          activeOpacity={0.7}
        >
          <Text style={[styles.navText, activeTab === 'scan' && styles.navTextActive]}>
            Scan
          </Text>
          {isScanning ? (
            <Text style={styles.navSubScanning} numberOfLines={1}>
              Analyzing
            </Text>
          ) : scanData ? (
            <Text style={styles.navSubReady} numberOfLines={1}>
              Ready
            </Text>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'catalog' && styles.navItemActive]}
          onPress={() => handleTabPress('catalog')}
          activeOpacity={0.7}
        >
          <Text style={[styles.navText, activeTab === 'catalog' && styles.navTextActive]}>
            Catalog
          </Text>
          <Text style={styles.navSub} numberOfLines={1}>
            {stats.uniqueKanjiCount} kanji
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'history' && styles.navItemActive]}
          onPress={() => handleTabPress('history')}
          activeOpacity={0.7}
        >
          <Text style={[styles.navText, activeTab === 'history' && styles.navTextActive]}>
            History
          </Text>
          <Text style={styles.navSub} numberOfLines={1}>
            {history.length} scans
          </Text>
        </TouchableOpacity>
      </View>

      <ApiKeyModal
        visible={showKeyModal}
        onClose={() => setShowKeyModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111113',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#202026',
    backgroundColor: '#131317',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  keyBtn: {
    backgroundColor: '#1E1E26',
    borderWidth: 1,
    borderColor: '#2E2E3C',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  keyBtnText: {
    color: '#AAA',
    fontSize: 11,
    fontWeight: '600',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    backgroundColor: '#26161A',
    borderWidth: 1,
    borderColor: '#E05666',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoBadgeText: {
    color: '#E05666',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  titleCol: {
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: -0.2,
  },
  appSubtitle: {
    fontSize: 11,
    color: '#8A8A9A',
    marginTop: 1,
  },
  statsPill: {
    backgroundColor: '#1A1A22',
    borderWidth: 1,
    borderColor: '#282834',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    alignItems: 'center',
  },
  statsPillNum: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  statsPillLabel: {
    color: '#8A8A9A',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  body: {
    flex: 1,
  },
  tabView: {
    flex: 1,
  },
  tabHidden: {
    display: 'none',
  },
  nav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#202026',
    backgroundColor: '#141418',
    paddingTop: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  navItem: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#1A1A1E',
    minHeight: 46,
  },
  navItemActive: {
    backgroundColor: '#26262E',
    borderWidth: 1,
    borderColor: '#E05666',
  },
  navText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#8A8A9A',
  },
  navTextActive: {
    color: '#FFF',
  },
  navSub: {
    fontSize: 10,
    color: '#777785',
    marginTop: 2,
  },
  navSubScanning: {
    fontSize: 10,
    color: '#E05666',
    fontWeight: '700',
    marginTop: 2,
  },
  navSubReady: {
    fontSize: 10,
    color: '#2ED573',
    fontWeight: '700',
    marginTop: 2,
  },
});
