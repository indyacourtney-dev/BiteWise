// components/RecipeDetail.tsx
//
// The full recipe view. Both the "This or That" result screen and the
// "Surprise Me" randomizer render this, so a recipe looks identical no
// matter how the user arrived at it. Add a field here once and both
// screens pick it up.

import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import PlateVisualization from './PlateVisualization';
import { COLORS } from '../constants/Colors';
import { formatTime, getTotalTime, DIFFICULTY_LABELS } from '../constants/recipes';
import type { Recipe } from '../types';

interface Props {
  recipe: Recipe;
  /** Shown as a "% match" pill. Omit for the randomizer. */
  matchScore?: number;
  /** Plate-balance tip from the matching engine. */
  suggestion?: string;
  /** Optional line above the hero, e.g. the near-miss notice. */
  note?: string;
  /**
   * When provided, renders a "See full recipe" button under the plate
   * breakdown that opens this meal on its own screen. Used on the quiz
   * result, where people expect a button rather than a long scroll.
   * Omitted on the recipe screen itself — it's already the full recipe.
   */
  onOpenRecipe?: () => void;
}

export default function RecipeDetail({
  recipe,
  matchScore,
  suggestion,
  note,
  onOpenRecipe,
}: Props) {
  return (
    <View>
      {note ? (
        <View style={styles.noteBox}>
          <FontAwesome name="info-circle" size={14} color="#D46B08" />
          <Text style={styles.noteText}>{note}</Text>
        </View>
      ) : null}

      {/* HERO */}
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>{recipe.emoji}</Text>
        <Text style={styles.heroName}>{recipe.name}</Text>
        {typeof matchScore === 'number' ? (
          <View style={styles.matchPill}>
            <Text style={styles.matchPillText}>{matchScore}% match</Text>
          </View>
        ) : null}
      </View>

      {/* AT A GLANCE */}
      <View style={styles.statsRow}>
        <Stat icon="clock-o" label="Total" value={formatTime(getTotalTime(recipe))} />
        <Stat icon="signal" label="Level" value={DIFFICULTY_LABELS[recipe.difficulty]} />
        <Stat icon="users" label="Serves" value={`${recipe.servings}`} />
      </View>

      <View style={styles.timeSplit}>
        <Text style={styles.timeSplitText}>
          {recipe.prepMinutes} min prep · {recipe.cookMinutes} min cook
        </Text>
      </View>

      {/* PLATE BALANCE + MACROS */}
      <Text style={styles.sectionTitle}>Plate balance</Text>
      <PlateVisualization plate={recipe.plate} nutrition={recipe.nutrition} />
      {suggestion ? (
        <View style={[styles.card, styles.tipCard]}>
          <View style={styles.tipBox}>
            <FontAwesome name="lightbulb-o" size={14} color="#D46B08" />
            <Text style={styles.tipText}>{suggestion}</Text>
          </View>
        </View>
      ) : null}

      {/* JUMP TO FULL RECIPE */}
      {onOpenRecipe ? (
        <TouchableOpacity
          style={styles.openRecipeBtn}
          onPress={onOpenRecipe}
          activeOpacity={0.85}
        >
          <FontAwesome name="book" size={15} color={COLORS.darkNavy} />
          <View style={styles.flex1}>
            <Text style={styles.openRecipeTitle}>See the full recipe</Text>
            <Text style={styles.openRecipeSub}>
              {recipe.ingredients.length} ingredients · {recipe.instructions.length} steps
            </Text>
          </View>
          <FontAwesome name="chevron-right" size={13} color={COLORS.darkGold} />
        </TouchableOpacity>
      ) : null}

      {/* INGREDIENTS */}
      <Text style={styles.sectionTitle}>
        Ingredients <Text style={styles.sectionCount}>({recipe.ingredients.length})</Text>
      </Text>
      <View style={styles.card}>
        {recipe.ingredients.map((ing, i) => (
          <View
            key={`${ing.name}-${i}`}
            style={[styles.ingRow, i === recipe.ingredients.length - 1 && styles.noBorder]}
          >
            <View style={styles.bullet} />
            <Text style={styles.ingName}>
              {ing.name}
              {ing.optional ? <Text style={styles.optional}> · optional</Text> : null}
            </Text>
            <Text style={styles.ingAmount}>{ing.amount}</Text>
          </View>
        ))}
      </View>

      {/* STEPS */}
      <Text style={styles.sectionTitle}>How to make it</Text>
      <View style={styles.card}>
        {recipe.instructions.map((step, i) => (
          <View
            key={i}
            style={[styles.stepRow, i === recipe.instructions.length - 1 && styles.noBorder]}
          >
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      {/* DIETARY */}
      {(recipe.dietary.length > 0 || recipe.allergens.length > 0) && (
        <>
          <Text style={styles.sectionTitle}>Good to know</Text>
          <View style={styles.card}>
            {recipe.dietary.length > 0 && (
              <View style={styles.chipRow}>
                {recipe.dietary.map(tag => (
                  <View key={tag} style={styles.chip}>
                    <Text style={styles.chipText}>{tag.replace(/-/g, ' ')}</Text>
                  </View>
                ))}
              </View>
            )}
            {recipe.allergens.length > 0 && (
              <Text style={styles.allergenLine}>
                Contains: {recipe.allergens.join(', ')}
              </Text>
            )}
          </View>
        </>
      )}
    </View>
  );
}

function Stat({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <FontAwesome name={icon} size={15} color={COLORS.darkGold} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },

  openRecipeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.lightYellow,
    borderWidth: 1,
    borderColor: COLORS.goldYellow,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 14,
  },
  openRecipeTitle: { fontSize: 15, fontWeight: '700', color: COLORS.darkNavy },
  openRecipeSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF7E6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  noteText: { flex: 1, fontSize: 13, color: '#8C5A0B', lineHeight: 18 },

  hero: { alignItems: 'center', paddingVertical: 8, marginBottom: 16 },
  heroEmoji: { fontSize: 64, marginBottom: 8 },
  heroName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.darkNavy,
    textAlign: 'center',
    lineHeight: 31,
  },
  matchPill: {
    marginTop: 10,
    backgroundColor: COLORS.lightYellow,
    borderWidth: 1,
    borderColor: COLORS.goldYellow,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  matchPillText: { fontSize: 13, fontWeight: '700', color: COLORS.darkGold },

  statsRow: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.cardWhite,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  statValue: { marginTop: 6, fontSize: 14, fontWeight: '700', color: COLORS.darkNavy },
  statLabel: { marginTop: 2, fontSize: 11, color: COLORS.textMuted },

  timeSplit: { alignItems: 'center', marginTop: 10 },
  timeSplitText: { fontSize: 12, color: COLORS.textMuted },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.darkNavy,
    marginTop: 26,
    marginBottom: 10,
  },
  sectionCount: { fontSize: 13, fontWeight: '400', color: COLORS.textMuted },

  card: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  ingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.goldYellow,
    marginRight: 12,
  },
  ingName: { flex: 1, fontSize: 14, color: COLORS.darkNavy, textTransform: 'capitalize' },
  optional: { fontSize: 12, color: COLORS.textMuted, textTransform: 'none' },
  ingAmount: { fontSize: 13, color: COLORS.textMuted, marginLeft: 10 },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.lightYellow,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  stepNumText: { fontSize: 12, fontWeight: '700', color: COLORS.darkGold },
  stepText: { flex: 1, fontSize: 14, color: COLORS.darkNavy, lineHeight: 21 },

  noBorder: { borderBottomWidth: 0 },

  tipCard: { marginTop: 10 },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF7E6',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  tipText: { flex: 1, fontSize: 13, color: '#8C5A0B', lineHeight: 18 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#F1F6FD',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    color: COLORS.darkNavy,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  allergenLine: {
    marginTop: 10,
    fontSize: 12,
    color: COLORS.redAccent,
    textTransform: 'capitalize',
  },
});
