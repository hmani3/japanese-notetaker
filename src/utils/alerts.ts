import { Alert, Platform } from 'react-native';

/**
 * Cross-platform alert dialog.
 * react-native-web's Alert.alert is a no-op stub, so on web we use window.alert.
 */
export function showAlert(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(message ? `${title}\n\n${message}` : title);
    }
    return;
  }
  Alert.alert(title, message);
}

/**
 * Cross-platform confirmation dialog for destructive or confirmed actions.
 */
export function confirmAction(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void | Promise<void>
): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm(`${title}\n\n${message}`)) {
        void onConfirm();
      }
    }
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: confirmLabel,
      style: 'destructive',
      onPress: () => {
        void onConfirm();
      },
    },
  ]);
}
