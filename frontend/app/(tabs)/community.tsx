// app/(tabs)/community.tsx — Task 1.7
//
// Two ways BiteWise users help each other decide:
//   Chat rooms    one per meal (Breakfast Club, Dinner Table, Sweet Tooth,
//                 Can't Decide...) plus rooms users start themselves
//   Home recipes  recipes users share from their own kitchens; they join the
//                 recipe database, so they're suggested to everyone
//                 (Decide for Me, pantry matching) and can be hearted

import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useFocusEffect, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import MealTypePicker from '@/components/MealTypePicker';
import RecipeListCard from '@/components/RecipeListCard';
import { COLORS } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { configured } from '@/lib/supabase';
import { createRoom, fetchCommunityRecipes, listRooms, type ChatRoom } from '@/lib/communityApi';
import { MEAL_INFO } from '@/utils/meals';
import { ageAllowsRecipe } from '@/utils/matching';
import type { MealType, Recipe } from '@/types';

type Section = 'rooms' | 'recipes';
const ROOM_EMOJIS = ['💬', '🍳', '🥗', '🌮', '🍝', '🍰', '🌱', '🔥', '👨‍👩‍👧', '🏋️'];

export default function CommunityScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const { user } = useAuth();
  const { mealType, preferences } = useApp();

  const [section, setSection] = useState<Section>('rooms');
  const [rooms, setRooms] = useState<ChatRoom[] | null>(null);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [recipeMeal, setRecipeMeal] = useState<MealType>(mealType);
  const [sort, setSort] = useState<'new' | 'popular'>('popular');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // New-room form
  const [creating, setCreating] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomEmoji, setRoomEmoji] = useState(ROOM_EMOJIS[0]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!configured) return;
    setError(null);
    try {
      if (section === 'rooms') setRooms(await listRooms());
      // Age safeguard: recipes made with alcohol only for 21+.
      else setRecipes((await fetchCommunityRecipes({ mealType: recipeMeal, sort })).filter(r => ageAllowsRecipe(r, preferences)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load');
    }
  }, [section, recipeMeal, sort, preferences]);

  // Reload whenever the tab is shown (new messages / recipes since last time).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const submitRoom = async () => {
    if (!user || roomName.trim().length < 2) return;
    setSaving(true);
    try {
      const id = await createRoom({ name: roomName, emoji: roomEmoji, userId: user.id });
      setCreating(false);
      setRoomName('');
      router.push(`/chat/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the room');
    } finally {
      setSaving(false);
    }
  };

  if (!configured) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🔌</Text>
          <Text style={styles.emptyText}>Community needs the Supabase backend. Add the keys to frontend/.env.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + 32 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Community</Text>
        <Text style={styles.sub}>Swap ideas, share home recipes, and let the crew help you decide.</Text>

        <View style={styles.segment}>
          {(['rooms', 'recipes'] as Section[]).map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.segmentBtn, section === s && styles.segmentBtnActive]}
              onPress={() => setSection(s)}
            >
              <Text style={[styles.segmentText, section === s && styles.segmentTextActive]}>
                {s === 'rooms' ? '💬 Chat rooms' : '🏠 Home recipes'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {section === 'rooms' ? (
          <>
            {creating ? (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Start a room</Text>
                <TextInput
                  style={styles.input}
                  value={roomName}
                  onChangeText={setRoomName}
                  placeholder="e.g. Meal prep Sundays"
                  placeholderTextColor={COLORS.inactiveGray}
                  maxLength={60}
                />
                <View style={styles.emojiRow}>
                  {ROOM_EMOJIS.map(e => (
                    <TouchableOpacity
                      key={e}
                      style={[styles.emojiBtn, roomEmoji === e && styles.emojiBtnActive]}
                      onPress={() => setRoomEmoji(e)}
                    >
                      <Text style={styles.emoji}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.formActions}>
                  <TouchableOpacity onPress={() => setCreating(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.smallBtn, roomName.trim().length < 2 && { opacity: 0.5 }]}
                    onPress={submitRoom}
                    disabled={saving || roomName.trim().length < 2}
                  >
                    {saving ? <ActivityIndicator color={COLORS.darkNavy} /> : <Text style={styles.smallBtnText}>Create</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.actionBtn} onPress={() => setCreating(true)}>
                <FontAwesome name="plus" size={14} color={COLORS.darkNavy} />
                <Text style={styles.actionBtnText}>Start a room</Text>
              </TouchableOpacity>
            )}

            {rooms === null ? <ActivityIndicator color={COLORS.darkNavy} style={{ marginTop: 24 }} /> : null}
            {rooms?.map(room => (
              <TouchableOpacity
                key={room.id}
                style={styles.roomCard}
                onPress={() => router.push(`/chat/${room.id}`)}
                activeOpacity={0.85}
              >
                <Text style={styles.roomEmoji}>{room.emoji}</Text>
                <View style={styles.flex1}>
                  <Text style={styles.roomName}>{room.name}</Text>
                  {room.description ? <Text style={styles.roomDesc} numberOfLines={2}>{room.description}</Text> : null}
                  <Text style={styles.roomMeta}>
                    {room.memberCount} member{room.memberCount === 1 ? '' : 's'}
                    {room.mealType ? ` · ${MEAL_INFO[room.mealType].emoji} ${MEAL_INFO[room.mealType].label}` : ''}
                  </Text>
                </View>
                {room.joined ? (
                  <View style={styles.joinedPill}><Text style={styles.joinedText}>Joined</Text></View>
                ) : (
                  <FontAwesome name="chevron-right" size={13} color={COLORS.inactiveGray} />
                )}
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.shareBtn} onPress={() => router.push('/shareRecipe')} activeOpacity={0.9}>
              <FontAwesome name="upload" size={15} color={COLORS.darkNavy} />
              <Text style={styles.shareBtnText}>Share your home recipe</Text>
            </TouchableOpacity>

            <MealTypePicker value={recipeMeal} onChange={setRecipeMeal} />
            <View style={styles.sortRow}>
              {(['popular', 'new'] as const).map(s => (
                <TouchableOpacity key={s} onPress={() => setSort(s)}>
                  <Text style={[styles.sortText, sort === s && styles.sortTextActive]}>
                    {s === 'popular' ? 'Most saved' : 'Newest'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {recipes === null ? <ActivityIndicator color={COLORS.darkNavy} style={{ marginTop: 24 }} /> : null}
            {recipes?.length === 0 ? (
              <Text style={styles.emptyText}>
                No home {MEAL_INFO[recipeMeal].label.toLowerCase()} recipes yet — be the first to share one!
              </Text>
            ) : null}
            {recipes?.map(r => (
              <RecipeListCard key={r.id} recipe={r} onPress={() => router.push(`/recipe/${r.id}`)} />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  flex1: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.darkNavy },
  sub: { fontSize: 14, color: COLORS.textMuted, marginTop: 4, marginBottom: 16, lineHeight: 20 },
  error: { color: COLORS.redAccent, marginBottom: 10 },
  segment: {
    flexDirection: 'row',
    backgroundColor: COLORS.blueSoft,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: COLORS.cardWhite },
  segmentText: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },
  segmentTextActive: { color: COLORS.darkNavy },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.lightYellow,
    borderWidth: 1,
    borderColor: COLORS.goldYellow,
    marginBottom: 12,
  },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.darkNavy },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.cardWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 14,
    marginBottom: 10,
  },
  roomEmoji: { fontSize: 30 },
  roomName: { fontSize: 16, fontWeight: '700', color: COLORS.textDark },
  roomDesc: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  roomMeta: { fontSize: 12, color: COLORS.inactiveGray, marginTop: 4 },
  joinedPill: { backgroundColor: COLORS.lightYellow, borderRadius: 10, paddingVertical: 4, paddingHorizontal: 8 },
  joinedText: { fontSize: 11, fontWeight: '700', color: COLORS.darkGold },
  formCard: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  formTitle: { fontSize: 16, fontWeight: '700', color: COLORS.darkNavy },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textDark,
  },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  emojiBtn: { padding: 6, borderRadius: 10 },
  emojiBtnActive: { backgroundColor: COLORS.lightYellow },
  emoji: { fontSize: 22 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16 },
  cancelText: { color: COLORS.textMuted, fontWeight: '600' },
  smallBtn: {
    backgroundColor: COLORS.goldYellow,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 18,
    minWidth: 80,
    alignItems: 'center',
  },
  smallBtnText: { fontWeight: '700', color: COLORS.darkNavy },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.goldYellow,
    borderRadius: 14,
    paddingVertical: 13,
    marginBottom: 14,
  },
  shareBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.darkNavy },
  sortRow: { flexDirection: 'row', gap: 16, marginVertical: 12 },
  sortText: { fontSize: 14, fontWeight: '600', color: COLORS.inactiveGray },
  sortTextActive: { color: COLORS.darkNavy, textDecorationLine: 'underline' },
  emptyEmoji: { fontSize: 44 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20, marginTop: 10 },
});
