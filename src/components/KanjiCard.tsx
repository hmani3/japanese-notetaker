import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { KanjiEntry } from '../types';

interface KanjiCardProps {
  entry: KanjiEntry;
  onPress: () => void;
  resemblanceRank?: number;
}

export const KanjiCard: React.FC<KanjiCardProps> = ({ entry, onPress, resemblanceRank }) => {
  const meaning = entry.meanings.slice(0, 2).join(', ');
  const readings = [
    ...(entry.onyomi.slice(0, 1) || []),
    ...(entry.kunyomi.slice(0, 1) || []),
  ].join(' / ');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.char}>{entry.kanji}</Text>
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.meaning} numberOfLines={1}>
            {meaning || 'No definition'}
          </Text>
          <View style={styles.rightCol}>
            {resemblanceRank !== undefined && (
              <Text style={styles.rankBadge}>#{resemblanceRank}</Text>
            )}
            <Text style={styles.count}>{entry.frequency}×</Text>
          </View>
        </View>
        <Text style={styles.readings} numberOfLines={1}>
          {readings || '—'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#18181C',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#24242A',
  },
  char: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF',
    width: 40,
    textAlign: 'center',
    marginRight: 10,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meaning: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EEE',
    flex: 1,
    marginRight: 8,
  },
  count: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#E05666',
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E05666',
    backgroundColor: '#28171C',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E05666',
  },
  readings: {
    fontSize: 12,
    color: '#8A8A9A',
    marginTop: 2,
  },
});
