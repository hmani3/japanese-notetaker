import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Linking,
  Pressable,
} from 'react-native';
import { KanjiEntry } from '../types';

interface KanjiDetailModalProps {
  entry: KanjiEntry | null;
  visible: boolean;
  onClose: () => void;
}

export const KanjiDetailModal: React.FC<KanjiDetailModalProps> = ({
  entry,
  visible,
  onClose,
}) => {
  if (!entry) return null;

  const openJisho = () => {
    const url = `https://jisho.org/search/${encodeURIComponent(entry.kanji)}%20%23kanji`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.topRow}>
            <Text style={styles.kanjiChar}>{entry.kanji}</Text>
            <View style={styles.topMeta}>
              <Text style={styles.freqText}>Encountered: {entry.frequency}×</Text>
              {entry.jlpt !== null && <Text style={styles.metaSub}>JLPT N{entry.jlpt}</Text>}
              {entry.strokeCount !== null && (
                <Text style={styles.metaSub}>{entry.strokeCount} strokes</Text>
              )}
            </View>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.label}>Meanings</Text>
              <Text style={styles.value}>
                {entry.meanings.length > 0
                  ? entry.meanings.join(', ')
                  : 'No definition available'}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>{"On'yomi"}</Text>
              <Text style={styles.value}>
                {entry.onyomi.length > 0 ? entry.onyomi.join(', ') : '—'}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>{"Kun'yomi"}</Text>
              <Text style={styles.value}>
                {entry.kunyomi.length > 0 ? entry.kunyomi.join(', ') : '—'}
              </Text>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.jishoBtn} onPress={openJisho}>
              <Text style={styles.jishoBtnText}>Search on Jisho</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1C1C20',
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2C2C34',
    maxHeight: '70%',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#26262E',
    paddingBottom: 16,
    marginBottom: 14,
  },
  kanjiChar: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#FFF',
    width: 70,
  },
  topMeta: {
    flex: 1,
    marginLeft: 12,
    gap: 4,
  },
  freqText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E05666',
  },
  metaSub: {
    fontSize: 12,
    color: '#8A8A9A',
  },
  body: {
    marginBottom: 16,
  },
  section: {
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#777',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    color: '#DDD',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  jishoBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#26262E',
    alignItems: 'center',
  },
  jishoBtnText: {
    color: '#88A0D0',
    fontSize: 13,
    fontWeight: '600',
  },
  closeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#33333E',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
