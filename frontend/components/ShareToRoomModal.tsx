// components/ShareToRoomModal.tsx
//
// "Share to a chat room": lists the rooms the user has joined and posts
// the recipe there as a card (Task 1.7).

import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput } from 'react-native';

import { COLORS } from '../constants/Colors';
import { listRooms, sendMessage, type ChatRoom } from '../lib/communityApi';

interface Props {
  visible: boolean;
  recipe: { id: string; name: string } | null;
  onClose: () => void;
  onShared?: (roomId: string) => void;
}

export default function ShareToRoomModal({ visible, recipe, onClose, onShared }: Props) {
  const [rooms, setRooms] = useState<ChatRoom[] | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setNote('');
    listRooms()
      .then(all => setRooms(all.filter(r => r.joined)))
      .catch(e => setError(e.message));
  }, [visible]);

  const share = async (room: ChatRoom) => {
    if (!recipe) return;
    setSending(room.id);
    try {
      await sendMessage(room.id, note || `Check out ${recipe.name}!`, recipe.id);
      onShared?.(room.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not share');
    } finally {
      setSending(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Share to a chat room</Text>
          <TextInput
            style={styles.input}
            value={note}
            onChangeText={setNote}
            placeholder="Add a note (optional)"
            placeholderTextColor={COLORS.inactiveGray}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {rooms === null && !error ? <ActivityIndicator color={COLORS.darkNavy} style={{ marginVertical: 20 }} /> : null}
          {rooms?.length === 0 ? (
            <Text style={styles.empty}>Join a room in the Community tab first.</Text>
          ) : null}
          {rooms?.map(room => (
            <TouchableOpacity key={room.id} style={styles.room} onPress={() => share(room)} disabled={!!sending}>
              <Text style={styles.roomEmoji}>{room.emoji}</Text>
              <Text style={styles.roomName}>{room.name}</Text>
              {sending === room.id ? <ActivityIndicator color={COLORS.darkNavy} /> : null}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28,42,58,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    gap: 10,
  },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.darkNavy, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textDark,
  },
  room: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.cardWhite,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 14,
  },
  roomEmoji: { fontSize: 22 },
  roomName: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.textDark },
  empty: { color: COLORS.textMuted, fontSize: 14, marginVertical: 12 },
  error: { color: COLORS.redAccent, fontSize: 13 },
  cancel: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { color: COLORS.textMuted, fontSize: 15, fontWeight: '600' },
});
