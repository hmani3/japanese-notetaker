import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getApiKey, setApiKey } from '../services/visionScanner';
import { showAlert } from '../utils/alerts';

interface ApiKeyModalProps {
  visible: boolean;
  onClose: () => void;
  onKeySaved?: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  visible,
  onClose,
  onKeySaved,
}) => {
  const [keyInput, setKeyInput] = useState('');
  const [currentKeyMasked, setCurrentKeyMasked] = useState('');
  const [fullStoredKey, setFullStoredKey] = useState('');
  const [showStoredKey, setShowStoredKey] = useState(false);
  const [showInputKey, setShowInputKey] = useState(true); // Default to showing key while typing as requested

  useEffect(() => {
    if (visible) {
      (async () => {
        try {
          const key = await getApiKey();
          setFullStoredKey(key || '');
          if (key && key.length > 8) {
            setCurrentKeyMasked(`${key.slice(0, 6)}...${key.slice(-4)}`);
          } else if (key) {
            setCurrentKeyMasked('Configured');
          } else {
            setCurrentKeyMasked('Not set');
          }
        } catch {
          setFullStoredKey('');
          setCurrentKeyMasked('Not set');
        }
      })();
    }
  }, [visible]);

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setKeyInput(text.trim());
    }
  };

  const handleSave = async () => {
    if (!keyInput.trim()) {
      showAlert('Empty Key', 'Please enter or paste your Gemini API key.');
      return;
    }
    await setApiKey(keyInput.trim());
    const saved = keyInput.trim();
    setFullStoredKey(saved);
    if (saved.length > 8) {
      setCurrentKeyMasked(`${saved.slice(0, 6)}...${saved.slice(-4)}`);
    } else {
      setCurrentKeyMasked('Configured');
    }
    setKeyInput('');
    showAlert('Saved', 'Gemini API key saved to device storage.');
    if (onKeySaved) onKeySaved();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdropOverlay} />
        </TouchableWithoutFeedback>

        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Gemini Vision API Key</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.description}>
            Your key is stored securely in your device storage and is never sent to any intermediary server.
          </Text>

          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <Text style={styles.statusLabel}>Saved Key:</Text>
              <Text style={styles.statusValue} numberOfLines={showStoredKey ? undefined : 1}>
                {showStoredKey ? fullStoredKey : currentKeyMasked || 'Checking...'}
              </Text>
            </View>
            {fullStoredKey ? (
              <TouchableOpacity
                style={styles.statusToggleBtn}
                onPress={() => setShowStoredKey((prev) => !prev)}
                activeOpacity={0.7}
              >
                <Text style={styles.statusToggleBtnText}>
                  {showStoredKey ? 'Mask' : 'Show'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Paste Gemini API key..."
                placeholderTextColor="#666"
                value={keyInput}
                onChangeText={setKeyInput}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showInputKey}
              />
              <TouchableOpacity
                style={styles.toggleBtn}
                onPress={() => setShowInputKey((prev) => !prev)}
                activeOpacity={0.7}
              >
                <Text style={styles.toggleBtnText}>{showInputKey ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pasteBtn} onPress={handlePaste} activeOpacity={0.7}>
                <Text style={styles.pasteBtnText}>Paste</Text>
              </TouchableOpacity>
            </View>
            {keyInput.length > 0 && (
              <Text style={styles.charCountText}>{keyInput.length} characters</Text>
            )}
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
            <Text style={styles.saveBtnText}>Save Key</Text>
          </TouchableOpacity>
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
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: '#26262E',
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
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
  description: {
    fontSize: 12,
    color: '#8A8A9A',
    lineHeight: 18,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E1E24',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#282832',
  },
  statusLeft: {
    flex: 1,
    marginRight: 8,
  },
  statusLabel: {
    fontSize: 11,
    color: '#8A8A9A',
    marginBottom: 2,
  },
  statusValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2ED573',
  },
  statusToggleBtn: {
    backgroundColor: '#282834',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  statusToggleBtnText: {
    color: '#DDD',
    fontSize: 11,
    fontWeight: '600',
  },
  inputContainer: {
    gap: 4,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#111113',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#282832',
  },
  toggleBtn: {
    backgroundColor: '#282834',
    borderRadius: 6,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleBtnText: {
    color: '#DDD',
    fontSize: 12,
    fontWeight: '600',
  },
  pasteBtn: {
    backgroundColor: '#282834',
    borderRadius: 6,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pasteBtnText: {
    color: '#DDD',
    fontSize: 12,
    fontWeight: '600',
  },
  charCountText: {
    fontSize: 10,
    color: '#666',
    textAlign: 'right',
  },
  saveBtn: {
    backgroundColor: '#E05666',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
