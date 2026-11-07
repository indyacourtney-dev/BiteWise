// utils/confirm.ts — "Are you sure?" that works on every platform.
//
// React Native's Alert.alert with buttons is a silent no-op on the web
// build (the Delete-review bug), so destructive actions go through this:
// native gets the usual system dialog, web gets the browser's confirm box.

import { Alert, Platform } from 'react-native';

export function confirmAction(opts: {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  const { title, message, confirmLabel = 'OK', destructive = false, onConfirm } = opts;
  if (Platform.OS === 'web') {
    const w = globalThis as unknown as { confirm?: (s: string) => boolean };
    const ok = typeof w.confirm === 'function' ? w.confirm(message ? `${title}\n\n${message}` : title) : true;
    if (ok) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
