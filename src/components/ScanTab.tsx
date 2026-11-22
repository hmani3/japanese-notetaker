import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { ScanSummaryModal } from './ScanSummaryModal';
import { recordScanData } from '../services/storage';
import { scanMangaImage, scanMangaText } from '../services/visionScanner';
import { ExtractedScanData } from '../types';

interface ScanTabProps {
  onScanRecorded: () => void;
  isScanning: boolean;
  setIsScanning: (val: boolean) => void;
  scanData: ExtractedScanData | null;
  setScanData: (data: ExtractedScanData | null) => void;
  showSummary: boolean;
  setShowSummary: (val: boolean) => void;
  isCurrentTab: boolean;
}

export const ScanTab: React.FC<ScanTabProps> = ({
  onScanRecorded,
  isScanning,
  setIsScanning,
  scanData,
  setScanData,
  showSummary,
  setShowSummary,
  isCurrentTab,
}) => {
  const [directText, setDirectText] = useState('');

  const handleExtracted = (data: ExtractedScanData) => {
    if (
      data.individual.all.length === 0 &&
      data.compounds.length === 0 &&
      (!data.blurbs || data.blurbs.length === 0)
    ) {
      Alert.alert('No Content Found', 'No Kanji, compounds, or dialogue detected on this page.');
      return;
    }
    setScanData(data);
    // If user is currently on the scan tab, show summary immediately; otherwise keep held
    if (isCurrentTab) {
      setShowSummary(true);
    }
  };

  const handleImageScan = async (base64: string) => {
    setIsScanning(true);
    try {
      const data = await scanMangaImage(base64);
      setIsScanning(false);
      handleExtracted(data);
    } catch (err: any) {
      setIsScanning(false);
      Alert.alert('Scan Failed', err.message || 'Error scanning image.');
    }
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Denied', 'Camera permission is required.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
      base64: true,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      await handleImageScan(result.assets[0].base64);
    }
  };

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Denied', 'Photo library permission is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
      base64: true,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      await handleImageScan(result.assets[0].base64);
    }
  };

  const handlePasteClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (!text.trim()) {
      Alert.alert('Clipboard Empty', 'No text found in clipboard.');
      return;
    }
    setIsScanning(true);
    try {
      const data = await scanMangaText(text);
      setIsScanning(false);
      handleExtracted(data);
    } catch {
      setIsScanning(false);
      Alert.alert('Processing Failed', 'Could not process clipboard text.');
    }
  };

  const handleDirectSubmit = async () => {
    if (!directText.trim()) {
      Alert.alert('Empty Input', 'Enter or paste Japanese text.');
      return;
    }
    setIsScanning(true);
    try {
      const data = await scanMangaText(directText);
      setIsScanning(false);
      setDirectText('');
      handleExtracted(data);
    } catch {
      setIsScanning(false);
      Alert.alert('Processing Failed', 'Could not process text.');
    }
  };

  const handleSaveToCatalog = async () => {
    if (!scanData) return;
    try {
      const { newKanjiCount, updatedKanjiCount, newCompoundCount } = await recordScanData(scanData);
      setShowSummary(false);
      setScanData(null);
      onScanRecorded();
      Alert.alert(
        'Saved',
        `Catalogued ${newKanjiCount} new Kanji (${updatedKanjiCount} updated) and ${newCompoundCount} new Compounds.`
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save.');
    }
  };

  const handleDiscardSummary = () => {
    setShowSummary(false);
    setScanData(null);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* If a previous scan is holding a summary and user closed the modal */}
      {scanData && !isScanning && !showSummary && (
        <View style={styles.heldNoticeBox}>
          <View style={styles.heldNoticeLeft}>
            <Text style={styles.heldNoticeTitle}>Pending Scan Summary</Text>
            <Text style={styles.heldNoticeSubtitle}>
              {scanData.individual.unique.length} Kanji • {scanData.compounds.length} Compounds
              {scanData.blurbs && scanData.blurbs.length > 0
                ? ` • ${scanData.blurbs.length} Blurbs`
                : ''}{' '}
              waiting
            </Text>
          </View>
          <TouchableOpacity style={styles.heldReviewBtn} onPress={() => setShowSummary(true)}>
            <Text style={styles.heldReviewBtnText}>Review</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Image Scan Actions */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Scan Manga Page</Text>
          <Text style={styles.sectionHint}>Physical page photo</Text>
        </View>
        {isScanning ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#E05666" />
            <Text style={styles.loadingText}>Reading Kanji & Compounds in manga order...</Text>
            <Text style={styles.loadingHint}>Feel free to browse other tabs, scan will continue.</Text>
          </View>
        ) : (
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.btnPrimary} onPress={handleTakePhoto} activeOpacity={0.8}>
              <Text style={styles.btnPrimaryText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnSecondary} onPress={handlePickPhoto} activeOpacity={0.8}>
              <Text style={styles.btnSecondaryText}>Select Photo</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Text Input */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Direct Text Input</Text>
          <Text style={styles.sectionHint}>Clipboard / Live Text</Text>
        </View>
        <TouchableOpacity style={styles.btnOutline} onPress={handlePasteClipboard} activeOpacity={0.8}>
          <Text style={styles.btnOutlineText}>Paste from Clipboard</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          multiline
          placeholder="Or type/paste Japanese text directly..."
          placeholderTextColor="#666"
          value={directText}
          onChangeText={setDirectText}
        />
        <TouchableOpacity style={styles.btnPrimary} onPress={handleDirectSubmit} activeOpacity={0.8}>
          <Text style={styles.btnPrimaryText}>Catalog from Text</Text>
        </TouchableOpacity>
      </View>

      <ScanSummaryModal
        visible={showSummary}
        scanData={scanData}
        onSave={handleSaveToCatalog}
        onCancel={handleDiscardSummary}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111113',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  heldNoticeBox: {
    backgroundColor: '#231418',
    borderWidth: 1,
    borderColor: '#E05666',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heldNoticeLeft: {
    flex: 1,
    marginRight: 10,
  },
  heldNoticeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF',
  },
  heldNoticeSubtitle: {
    fontSize: 12,
    color: '#E05666',
    marginTop: 2,
  },
  heldReviewBtn: {
    backgroundColor: '#E05666',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  heldReviewBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: '#1A1A1E',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#26262C',
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A8A9A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHint: {
    fontSize: 11,
    color: '#666675',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#E05666',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: '#26262E',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#363642',
  },
  btnSecondaryText: {
    color: '#DDD',
    fontSize: 14,
    fontWeight: '600',
  },
  btnOutline: {
    backgroundColor: '#222228',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#33333E',
  },
  btnOutlineText: {
    color: '#9A9AB0',
    fontSize: 13,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#111113',
    borderRadius: 6,
    padding: 10,
    color: '#FFF',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#26262C',
  },
  loadingBox: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  loadingText: {
    color: '#EEE',
    fontSize: 13,
    fontWeight: '600',
  },
  loadingHint: {
    color: '#777',
    fontSize: 11,
  },
});
