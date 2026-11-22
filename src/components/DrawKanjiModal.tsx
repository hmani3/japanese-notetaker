import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  PanResponder,
  PanResponderInstance,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { recognizeKanjiDrawing, Stroke } from '../services/handwritingRecognizer';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CANVAS_SIZE = Math.min(SCREEN_WIDTH - 64, 260);
const SHEET_HEIGHT = Math.min(Math.max(SCREEN_HEIGHT * 0.65, 490), 520);

interface DrawKanjiModalProps {
  visible: boolean;
  catalogKanji: string[];
  onSelectMatch: (kanji: string) => void;
  onApplyResemblanceOrder: (candidates: string[]) => void;
  onClose: () => void;
}

export const DrawKanjiModal: React.FC<DrawKanjiModalProps> = ({
  visible,
  catalogKanji,
  onSelectMatch,
  onApplyResemblanceOrder,
  onClose,
}) => {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke>([]);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [panResponder, setPanResponder] = useState<PanResponderInstance | null>(null);

  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke>([]);

  const runRecognition = async (currentStrokes: Stroke[]) => {
    if (currentStrokes.length === 0) {
      setCandidates([]);
      return;
    }
    setIsRecognizing(true);
    try {
      const results = await recognizeKanjiDrawing(currentStrokes, CANVAS_SIZE);
      setCandidates(results);
    } catch {
      setCandidates([]);
    } finally {
      setIsRecognizing(false);
    }
  };

  useEffect(() => {
    const pr = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const pt = { x: locationX, y: locationY };
        currentStrokeRef.current = [pt];
        setCurrentStroke([pt]);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const pt = { x: locationX, y: locationY };
        currentStrokeRef.current.push(pt);
        setCurrentStroke([...currentStrokeRef.current]);
      },
      onPanResponderRelease: () => {
        if (currentStrokeRef.current.length > 0) {
          const finished = [...currentStrokeRef.current];
          strokesRef.current.push(finished);
          setStrokes([...strokesRef.current]);
          currentStrokeRef.current = [];
          setCurrentStroke([]);
          runRecognition([...strokesRef.current]);
        }
      },
    });
    setPanResponder(pr);
  }, []);

  const handleClear = () => {
    strokesRef.current = [];
    currentStrokeRef.current = [];
    setStrokes([]);
    setCurrentStroke([]);
    setCandidates([]);
  };

  const handleUndo = () => {
    if (strokesRef.current.length > 0) {
      strokesRef.current.pop();
      setStrokes([...strokesRef.current]);
      runRecognition([...strokesRef.current]);
    }
  };

  const strokeToPath = (points: Stroke): string => {
    if (points.length === 0) return '';
    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
    }
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  };

  const inCatalogCandidates = candidates.filter((c) => catalogKanji.includes(c));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdropOverlay} />
        </TouchableWithoutFeedback>

        <View style={styles.sheet}>
          {/* Header - Fixed Height */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Draw Kanji to Search</Text>
              <Text style={styles.subtitle}>Sketch strokes to find closest catalog matches</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Canvas Box - Fixed Position & Size */}
          <View style={styles.canvasWrapper}>
            <View
              {...(panResponder?.panHandlers || {})}
              style={[styles.canvasBox, { width: CANVAS_SIZE, height: CANVAS_SIZE }]}
            >
              <Svg
                pointerEvents="none"
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                style={StyleSheet.absoluteFill}
              >
                {/* Center crosshair practice guides */}
                <Line
                  x1={0}
                  y1={CANVAS_SIZE / 2}
                  x2={CANVAS_SIZE}
                  y2={CANVAS_SIZE / 2}
                  stroke="#262632"
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />
                <Line
                  x1={CANVAS_SIZE / 2}
                  y1={0}
                  x2={CANVAS_SIZE / 2}
                  y2={CANVAS_SIZE}
                  stroke="#262632"
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />

                {/* Finished strokes */}
                {strokes.map((stroke, index) => (
                  <Path
                    key={`stroke-${index}`}
                    d={strokeToPath(stroke)}
                    stroke="#FFFFFF"
                    strokeWidth={5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ))}

                {/* Current drawing stroke */}
                {currentStroke.length > 0 && (
                  <Path
                    d={strokeToPath(currentStroke)}
                    stroke="#E05666"
                    strokeWidth={5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                )}
              </Svg>
            </View>

            {/* Drawing controls - Fixed Position */}
            <View style={styles.canvasControls}>
              <TouchableOpacity
                style={[styles.actionBtn, strokes.length === 0 && styles.actionBtnDisabled]}
                onPress={handleUndo}
                disabled={strokes.length === 0}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.actionBtnText,
                    strokes.length === 0 && styles.actionBtnTextDisabled,
                  ]}
                >
                  Undo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, strokes.length === 0 && styles.actionBtnDisabled]}
                onPress={handleClear}
                disabled={strokes.length === 0}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.actionBtnText,
                    strokes.length === 0 && styles.actionBtnTextDisabled,
                  ]}
                >
                  Clear
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Results Area - Rigid Fixed Height & Scrollable Candidates */}
          <View style={styles.resultsSection}>
            <View style={styles.resultsHeaderRow}>
              <Text style={styles.resultsHeader}>Closest Resemblance</Text>
              {isRecognizing ? (
                <ActivityIndicator size="small" color="#E05666" />
              ) : (
                candidates.length > 0 && (
                  <Text style={styles.candidateCountBadge}>{candidates.length} matches</Text>
                )
              )}
            </View>

            {/* Horizontally scrollable candidates or placeholder */}
            {candidates.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.candidatesScroll}
                style={styles.candidatesScrollContainer}
              >
                {candidates.map((char) => {
                  const isInCatalog = catalogKanji.includes(char);
                  return (
                    <TouchableOpacity
                      key={char}
                      style={[
                        styles.candidatePill,
                        isInCatalog && styles.candidatePillCatalog,
                      ]}
                      onPress={() => {
                        onSelectMatch(char);
                        onClose();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.candidateChar}>{char}</Text>
                      {isInCatalog && <Text style={styles.inCatalogDot}>•</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.candidatesPlaceholder}>
                <Text style={styles.hintText}>
                  {strokes.length > 0
                    ? 'Analyzing drawing...'
                    : 'Draw with your finger in the square above.'}
                </Text>
              </View>
            )}

            {/* Fixed Action Button Slot */}
            <View style={styles.actionSlot}>
              {inCatalogCandidates.length > 0 ? (
                <TouchableOpacity
                  style={styles.applySortBtn}
                  onPress={() => {
                    onApplyResemblanceOrder(candidates);
                    onClose();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.applySortBtnText}>
                    Sort Catalog by Resemblance ({inCatalogCandidates.length} in catalog)
                  </Text>
                </TouchableOpacity>
              ) : candidates.length > 0 ? (
                <Text style={styles.noCatalogNotice} numberOfLines={1}>
                  Not in catalog yet. Tap any candidate above to search.
                </Text>
              ) : (
                <View style={styles.emptyActionPlaceholder} />
              )}
            </View>
          </View>
        </View>
      </View>
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
    height: SHEET_HEIGHT,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderColor: '#26262E',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    height: 38,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  subtitle: {
    fontSize: 11,
    color: '#8A8A9A',
    marginTop: 1,
  },
  closeBtn: {
    backgroundColor: '#26262E',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  closeBtnText: {
    color: '#DDD',
    fontSize: 12,
    fontWeight: '600',
  },
  canvasWrapper: {
    alignItems: 'center',
    marginBottom: 10,
  },
  canvasBox: {
    backgroundColor: '#1C1C22',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2E2E38',
    overflow: 'hidden',
  },
  canvasControls: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionBtn: {
    paddingVertical: 5,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#22222A',
    borderWidth: 1,
    borderColor: '#2E2E3A',
  },
  actionBtnDisabled: {
    opacity: 0.35,
  },
  actionBtnText: {
    color: '#DDD',
    fontSize: 12,
    fontWeight: '600',
  },
  actionBtnTextDisabled: {
    color: '#666',
  },
  resultsSection: {
    backgroundColor: '#1A1A20',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#26262E',
    height: 125,
    justifyContent: 'space-between',
  },
  resultsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 18,
  },
  resultsHeader: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8A8A9A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  candidateCountBadge: {
    fontSize: 10,
    color: '#666675',
  },
  candidatesScrollContainer: {
    height: 46,
    flexGrow: 0,
  },
  candidatesScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 1,
  },
  candidatesPlaceholder: {
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  candidatePill: {
    backgroundColor: '#24242E',
    borderRadius: 6,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#30303E',
    position: 'relative',
  },
  candidatePillCatalog: {
    borderColor: '#E05666',
    backgroundColor: '#281E22',
  },
  candidateChar: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
  },
  inCatalogDot: {
    position: 'absolute',
    top: 1,
    right: 4,
    fontSize: 10,
    color: '#E05666',
    fontWeight: 'bold',
  },
  actionSlot: {
    height: 36,
    justifyContent: 'center',
  },
  applySortBtn: {
    backgroundColor: '#E05666',
    height: 34,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applySortBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  noCatalogNotice: {
    color: '#888',
    fontSize: 11,
    textAlign: 'center',
  },
  emptyActionPlaceholder: {
    height: 34,
  },
  hintText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },
});

