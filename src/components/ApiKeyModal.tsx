import React, { useEffect, useState } from 'react';
import {
  Alert,
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

  useEffect(() => {
    if (visible) {
      (async () => {
        try {
          const key = await getApiKey();
          if (key && key.length > 8) {
            setCurrentKeyMasked(`${key.slice(0, 6)}...${key.slice(-4)}`);
          } else if (key) {
            setCurrentKeyMasked('Configured');
          } else {
            setCurrentKeyMasked('Not set');
          }
        } catch {
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
      Alert.alert('Empty Key', 'Please enter or paste your Gemini API key.');
      return;
    }
    await setApiKey(keyInput.trim());
    setKeyInput('');
    Alert.alert('Saved', 'Gemini API key saved to device storage.');
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
            Your key is stored securely in local device storage and is never uploaded to any server.
          </Text>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Current Status:</Text>
            <Text style={styles.statusValue}>{currentKeyMasked || 'Checking...'}</Text>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Paste Gemini API key..."
              placeholderTextColor="#666"
              value={keyInput}
              onChangeText={setKeyInput}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <TouchableOpacity style={styles.pasteBtn} onPress={handlePaste} activeOpacity={0.7}>
              <Text style={styles.pasteBtnText}>Paste</Text>
            </TouchableOpacity>
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
    gap: 8,
    backgroundColor: '#1E1E24',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#282832',
  },
  statusLabel: {
    fontSize: 12,
    color: '#8A8A9A',
  },
  statusValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2ED573',
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
