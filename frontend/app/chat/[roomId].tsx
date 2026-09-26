// app/chat/[roomId].tsx — one chat room (Task 1.7)
//
// Live messages via Supabase Realtime; tap a recipe card to open it;
// attach one of your favorites with the paperclip; "Ask for ideas" posts a
// ready-made "help me decide" message for the current meal.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { COLORS } from '@/constants/Colors';
import { getRecipeById } from '@/constants/recipes';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { fetchRecipesByIds } from '@/lib/recipesApi';
import {
  fetchMessages, joinRoom, leaveRoom, listRooms, sendMessage, subscribeToRoom,
  type ChatMessage, type ChatRoom,
} from '@/lib/communityApi';
import { MEAL_INFO } from '@/utils/meals';
import { useAccessibility } from '@/hooks/useAccessibility';
import Avatar from '@/components/Avatar';
import { ageAllowsRecipe } from '@/utils/matching';
import { nameMentionsAlcohol } from '@/utils/alcohol';
import type { Recipe } from '@/types';

export default function ChatRoomScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { favorites, mealType, preferences } = useApp();

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [favRecipes, setFavRecipes] = useState<Recipe[]>([]);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const a11y = useAccessibility();

  const addMessage = useCallback((m: ChatMessage) => {
    setMessages(prev => (prev.some(x => x.id === m.id) ? prev : [...prev, m]));
  }, []);

  // Room info + messages; subscribe to live updates once joined.
  useEffect(() => {
    if (!roomId) return;
    let unsubscribe = () => {};
    let cancelled = false;
    (async () => {
      try {
        const found = (await listRooms()).find(r => r.id === roomId) ?? null;
        if (cancelled) return;
        setRoom(found);
        if (found?.joined) {
          setMessages(await fetchMessages(roomId));
          unsubscribe = subscribeToRoom(roomId, addMessage);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not open the room');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [roomId, room?.joined, addMessage]);

  useEffect(() => {
    if (messages.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length]);

  const join = async () => {
    if (!user || !room) return;
    try {
      await joinRoom(room.id, user.id);
      setRoom({ ...room, joined: true, memberCount: room.memberCount + 1 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join');
    }
  };

  const leave = async () => {
    if (!user || !room) return;
    await leaveRoom(room.id, user.id).catch(() => {});
    router.back();
  };

  const send = async (body: string, recipeId?: string) => {
    if (!roomId || (!body.trim() && !recipeId)) return;
    setSending(true);
    setError(null);
    try {
      addMessage(await sendMessage(roomId, body, recipeId));
      setText('');
      a11y.haptic('light');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send');
    } finally {
      setSending(false);
    }
  };

  const openPicker = async () => {
    setPicking(true);
    const ids = favorites.map(f => f.recipeId);
    const local = ids.map(id => getRecipeById(id)).filter((r): r is Recipe => Boolean(r));
    const remoteIds = ids.filter(id => !getRecipeById(id));
    const remote = await fetchRecipesByIds(remoteIds).catch(() => []);
    setFavRecipes([...local, ...remote].filter(r => ageAllowsRecipe(r, preferences)));
  };

  const askForIdeas = () =>
    send(`Can't decide what to make for ${MEAL_INFO[mealType].label.toLowerCase()} ${MEAL_INFO[mealType].emoji} — what would you make?`);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator color={COLORS.darkNavy} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <FontAwesome name="chevron-left" size={16} color={COLORS.darkNavy} />
        </TouchableOpacity>
        <View style={styles.flex1}>
          <Text style={styles.headerTitle} numberOfLines={1}>{room ? `${room.emoji} ${room.name}` : 'Chat'}</Text>
          {room ? <Text style={styles.headerSub}>{room.memberCount} members</Text> : null}
        </View>
        {room?.joined && !room.isDefault ? (
          <TouchableOpacity onPress={leave}>
            <Text style={styles.leaveText}>Leave</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {!room ? (
        <Text style={styles.centerText}>This room doesn't exist anymore.</Text>
      ) : !room.joined ? (
        <View style={styles.joinBox}>
          <Text style={styles.joinEmoji}>{room.emoji}</Text>
          <Text style={styles.joinTitle}>{room.name}</Text>
          {room.description ? <Text style={styles.centerText}>{room.description}</Text> : null}
          <TouchableOpacity style={styles.joinBtn} onPress={join}>
            <Text style={styles.joinBtnText}>Join the room</Text>
          </TouchableOpacity>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex1}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => String(m.id)}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.centerText}>No messages yet. Say hi, or share a recipe you love!</Text>
            }
            renderItem={({ item }) => {
              const mine = item.userId === user?.id;
              return (
                <View style={[styles.msgRow, mine && styles.msgRowMine]}>
                  {!mine ? (
                    <Avatar
                      url={item.author.avatarUrl}
                      emoji={item.author.avatarEmoji}
                      size={32}
                      label={`${item.author.username ?? 'BiteWise cook'}'s profile picture`}
                    />
                  ) : null}
                  <View style={[styles.bubble, mine && styles.bubbleMine]}>
                    {!mine ? <Text style={styles.author}>{item.author.username ?? 'BiteWise cook'}</Text> : null}
                    {item.body ? <Text style={[styles.body, a11y.text(15), mine && styles.bodyMine]}>{item.body}</Text> : null}
                    {item.recipe ? (
                      <TouchableOpacity
                        style={styles.recipeCard}
                        onPress={() => router.push(`/recipe/${item.recipe!.id}`)}
                        activeOpacity={0.85}
                      >
                        {/* Age safeguard: under-21s don't see alcohol recipe names in chat. */}
                        {!preferences.allowAlcohol && nameMentionsAlcohol(item.recipe.name) ? (
                          <>
                            <Text style={styles.recipeEmoji}>🔞</Text>
                            <Text style={styles.recipeName} numberOfLines={2}>A recipe for 21+</Text>
                          </>
                        ) : (
                          <>
                            <Text style={styles.recipeEmoji}>{item.recipe.emoji}</Text>
                            <Text style={styles.recipeName} numberOfLines={2}>{item.recipe.name}</Text>
                          </>
                        )}
                        <FontAwesome name="chevron-right" size={12} color={COLORS.darkGold} />
                      </TouchableOpacity>
                    ) : null}
                    <Text style={[styles.time, mine && styles.timeMine]}>
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          {error ? <Text style={[styles.error, { paddingHorizontal: 16 }]}>{error}</Text> : null}

          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.quickBtn} onPress={askForIdeas} disabled={sending}>
              <Text style={styles.quickText}>🤔 Ask for {MEAL_INFO[mealType].label.toLowerCase()} ideas</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <TouchableOpacity style={styles.attachBtn} onPress={openPicker} accessibilityRole="button" accessibilityLabel="Share one of your favorite recipes">
              <FontAwesome name="paperclip" size={18} color={COLORS.darkNavy} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Message"
              placeholderTextColor={COLORS.inactiveGray}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
              onPress={() => send(text)}
              disabled={!text.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              <FontAwesome name="send" size={15} color={COLORS.darkNavy} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Share one of your favorites */}
      <Modal visible={picking} transparent animationType="slide" onRequestClose={() => setPicking(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Share a favorite</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {favRecipes.length === 0 ? (
                <Text style={styles.centerText}>Heart some recipes first — they'll show up here.</Text>
              ) : (
                favRecipes.map(r => (
                  <TouchableOpacity
                    key={r.id}
                    style={styles.pickRow}
                    onPress={() => {
                      setPicking(false);
                      send(text || `I love this one!`, r.id);
                    }}
                  >
                    <Text style={styles.recipeEmoji}>{r.emoji}</Text>
                    <Text style={styles.pickName}>{r.name}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={styles.cancel} onPress={() => setPicking(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.darkNavy },
  headerSub: { fontSize: 12, color: COLORS.textMuted },
  leaveText: { color: COLORS.redAccent, fontWeight: '600', paddingHorizontal: 8 },
  centerText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20, marginTop: 20, paddingHorizontal: 24 },
  joinBox: { alignItems: 'center', padding: 32, gap: 8 },
  joinEmoji: { fontSize: 56 },
  joinTitle: { fontSize: 22, fontWeight: '700', color: COLORS.darkNavy },
  joinBtn: { marginTop: 16, backgroundColor: COLORS.goldYellow, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  joinBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.darkNavy },
  error: { color: COLORS.redAccent, fontSize: 13, marginTop: 6 },
  list: { padding: 14, gap: 10, flexGrow: 1 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '85%' },
  msgRowMine: { alignSelf: 'flex-end' },
  avatar: { fontSize: 22 },
  bubble: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    flexShrink: 1,
  },
  bubbleMine: { backgroundColor: COLORS.darkNavy, borderColor: COLORS.darkNavy, borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
  author: { fontSize: 12, fontWeight: '700', color: COLORS.darkGold, marginBottom: 2 },
  body: { fontSize: 15, color: COLORS.textDark, lineHeight: 20 },
  bodyMine: { color: COLORS.cardWhite },
  time: { fontSize: 10, color: COLORS.inactiveGray, marginTop: 4, alignSelf: 'flex-end' },
  timeMine: { color: COLORS.blueSoft },
  recipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.lightYellow,
    borderRadius: 12,
    padding: 10,
    marginTop: 6,
  },
  recipeEmoji: { fontSize: 24 },
  recipeName: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.darkNavy },
  quickRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 6 },
  quickBtn: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  quickText: { fontSize: 13, fontWeight: '600', color: COLORS.darkNavy },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  attachBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    maxHeight: 110,
    backgroundColor: COLORS.cardWhite,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: COLORS.textDark,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.goldYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(28,42,58,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: COLORS.darkNavy, marginBottom: 12 },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.cardWhite,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  pickName: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.textDark },
  cancel: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { color: COLORS.textMuted, fontSize: 15, fontWeight: '600' },
});
