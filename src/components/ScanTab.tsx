import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
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
import { showAlert, confirmAction } from '../utils/alerts';

const MAX_WEB_IMAGE_DIM = 1280;

/**
 * Downscales large mobile camera photos on web via HTML5 canvas
 * so uploads are ~200KB instead of 5-15MB while keeping manga Kanji sharp.
 */
async function compressBase64OnWeb(
  rawBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<{ base64: string; aspectRatio?: number }> {
  const base64 = rawBase64.replace(/^data:[^;]+;base64,/, '');
  if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof Image === 'undefined') {
    return { base64 };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      const aspectRatio = width > 0 && height > 0 ? width / height : undefined;
      if (width <= MAX_WEB_IMAGE_DIM && height <= MAX_WEB_IMAGE_DIM) {
        resolve({ base64, aspectRatio });
        return;
      }

      const scale = MAX_WEB_IMAGE_DIM / Math.max(width, height);
      const targetW = Math.round(width * scale);
      const targetH = Math.round(height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ base64, aspectRatio });
        return;
      }

      ctx.drawImage(img, 0, 0, targetW, targetH);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      const stripped = dataUrl.split(',')[1];
      resolve({ base64: stripped || base64, aspectRatio });
    };
    img.onerror = () => resolve({ base64 });
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

interface ScanTabProps {
  onScanRecorded: () => void;
  isScanning: boolean;
  setIsScanning: (val: boolean) => void;
  scanData: ExtractedScanData | null;
  setScanData: (data: ExtractedScanData | null) => void;
  showSummary: boolean;
  setShowSummary: (val: boolean) => void;
}

export const ScanTab: React.FC<ScanTabProps> = ({
  onScanRecorded,
  isScanning,
  setIsScanning,
  scanData,
  setScanData,
  showSummary,
  setShowSummary,
}) => {
  const [directText, setDirectText] = useState('');

  const handleExtracted = (data: ExtractedScanData) => {
    if (
      data.individual.all.length === 0 &&
      data.compounds.length === 0 &&
      (!data.blurbs || data.blurbs.length === 0)
    ) {
      showAlert('No Content Found', 'No Kanji, compounds, or dialogue detected on this page.');
      return;
    }
    setScanData(data);
    // Always open summary immediately when scan finishes so it stays open
    setShowSummary(true);
  };

  const handleImageScan = async (
    base64: string,
    mimeType?: string,
    width?: number,
    height?: number
  ) => {
    setIsScanning(true);
    try {
      const compressed = await compressBase64OnWeb(base64, mimeType || 'image/jpeg');
      const data = await scanMangaImage(compressed.base64, 'image/jpeg');
      const fallbackRatio = width && height && height > 0 ? width / height : undefined;
      data.imageUri = `data:image/jpeg;base64,${compressed.base64}`;
      data.imageAspectRatio = compressed.aspectRatio ?? fallbackRatio;
      setIsScanning(false);
      handleExtracted(data);
    } catch (err: any) {
      setIsScanning(false);
      showAlert('Scan Failed', err.message || 'Error scanning image.');
    }
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showAlert('Permission Denied', 'Camera permission is required.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.7,
      exif: false,
      base64: true,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      const asset = result.assets[0];
      await handleImageScan(asset.base64!, asset.mimeType, asset.width, asset.height);
    }
  };

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Permission Denied', 'Photo library permission is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.7,
      exif: false,
      base64: true,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      const asset = result.assets[0];
      await handleImageScan(asset.base64!, asset.mimeType, asset.width, asset.height);
    }
  };

  const handlePasteClipboard = async () => {
    if (isScanning) return;
    const text = await Clipboard.getStringAsync();
    if (!text.trim()) {
      showAlert('Clipboard Empty', 'No text found in clipboard.');
      return;
    }
    setIsScanning(true);
    try {
      const data = await scanMangaText(text);
      setIsScanning(false);
      handleExtracted(data);
    } catch {
      setIsScanning(false);
      showAlert('Processing Failed', 'Could not process clipboard text.');
    }
  };

  const handleDirectSubmit = async () => {
    if (isScanning) return;
    if (!directText.trim()) {
      showAlert('Empty Input', 'Enter or paste Japanese text.');
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
      showAlert('Processing Failed', 'Could not process text.');
    }
  };

  const handleSaveToCatalog = async () => {
    if (!scanData) return;
    try {
      const { newKanjiCount, updatedKanjiCount, newCompoundCount } = await recordScanData(scanData);
      setShowSummary(false);
      setScanData(null);
      onScanRecorded();
      showAlert(
        'Saved',
        `Catalogued ${newKanjiCount} new Kanji (${updatedKanjiCount} updated) and ${newCompoundCount} new Compounds.`
      );
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to save.');
    }
  };

  const handleDiscardSummary = () => {
    confirmAction(
      'Discard Scan',
      'Discard this unsaved scan? It has not been saved to your Catalog or History yet.',
      'Discard',
      () => {
        setShowSummary(false);
        setScanData(null);
      }
    );
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
        <TouchableOpacity
          style={[styles.btnOutline, isScanning && styles.btnDisabled]}
          onPress={handlePasteClipboard}
          disabled={isScanning}
          activeOpacity={0.8}
        >
          <Text style={styles.btnOutlineText}>Paste from Clipboard</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          multiline
          editable={!isScanning}
          placeholder="Or type/paste Japanese text directly..."
          placeholderTextColor="#666"
          value={directText}
          onChangeText={setDirectText}
        />
        <TouchableOpacity
          style={[styles.btnPrimary, isScanning && styles.btnDisabled]}
          onPress={handleDirectSubmit}
          disabled={isScanning}
          activeOpacity={0.8}
        >
          <Text style={styles.btnPrimaryText}>Catalog from Text</Text>
        </TouchableOpacity>
      </View>

      <ScanSummaryModal
        key={
          scanData
            ? `live-${scanData.individual.all.slice(0, 6).join('')}-${scanData.blurbs?.length || 0}`
            : 'live-empty'
        }
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
  btnDisabled: {
    opacity: 0.45,
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
