import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { COLORS } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import {
  deleteRecipeReview,
  fetchRecipeReviews,
  saveRecipeReview,
  type RecipeReview,
  type RecipeReviewData,
} from '../lib/reviewsApi';

const MAX_REVIEW_LENGTH = 300;
const EMPTY_DATA: RecipeReviewData = {
  averageRating: null,
  totalReviews: 0,
  reviews: [],
  ownReview: null,
};

function reviewErrorMessage(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String(reason);
  if (
    (message.includes('PGRST205') || message.includes('schema cache'))
    && /recipe_reviews|recipe_review_stats/.test(message)
  ) {
    return 'Reviews are not enabled in the database yet. Apply the recipe reviews migration from backend/supabase/migrations, then retry.';
  }
  return message || 'Could not load reviews.';
}

interface Props {
  recipeId: string;
  prompt?: boolean;
  onPromptDismiss?: () => void;
  onSummaryChange?: (summary: {
    averageRating: number | null;
    totalReviews: number;
    loading: boolean;
  }) => void;
  onLayout?: (y: number) => void;
}

export default function RecipeReviews({
  recipeId,
  prompt = false,
  onPromptDismiss,
  onSummaryChange,
  onLayout,
}: Props) {
  const { user } = useAuth();
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEditor(review: RecipeReview | null) {
    setRating(review?.rating ?? 0);
    setComment(review?.comment ?? '');
    setError(null);
    setModalVisible(true);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchRecipeReviews(recipeId)
      .then(result => {
        if (!cancelled) setData(result);
      })
      .catch(reason => {
        if (!cancelled) {
          setError(reviewErrorMessage(reason));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recipeId, refresh]);

  useEffect(() => {
    if (prompt && !loading) openEditor(data.ownReview);
  }, [prompt, loading, data.ownReview]);

  useEffect(() => {
    onSummaryChange?.({
      averageRating: data.averageRating,
      totalReviews: data.totalReviews,
      loading,
    });
  }, [data.averageRating, data.totalReviews, loading, onSummaryChange]);

  const closeEditor = () => {
    setModalVisible(false);
    onPromptDismiss?.();
  };

  const submitReview = async () => {
    if (rating < 1 || saving) {
      if (rating < 1) setError('Tap a star to choose your rating.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveRecipeReview(recipeId, rating, comment);
      setModalVisible(false);
      onPromptDismiss?.();
      setRefresh(value => value + 1);
    } catch (reason) {
      setError(reviewErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  const removeReview = () => {
    Alert.alert('Delete your review?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSaving(true);
            setError(null);
            try {
              await deleteRecipeReview(recipeId);
              setModalVisible(false);
              onPromptDismiss?.();
              setRefresh(value => value + 1);
            } catch (reason) {
              setError(reviewErrorMessage(reason));
            } finally {
              setSaving(false);
            }
          })();
        },
      },
    ]);
  };

  return (
    <View
      style={styles.section}
      onLayout={event => onLayout?.(event.nativeEvent.layout.y)}
    >
      <Text style={styles.sectionTitle}>Community reviews</Text>
      <View style={styles.summary}>
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.darkNavy} />
        ) : (
          <>
            <View style={styles.stars} accessibilityLabel={
              data.averageRating === null
                ? 'No ratings yet'
                : `Average rating ${data.averageRating.toFixed(1)} out of 5`
            }>
              {[1, 2, 3, 4, 5].map(star => (
                <FontAwesome
                  key={star}
                  name={data.averageRating !== null && star <= Math.round(data.averageRating) ? 'star' : 'star-o'}
                  size={17}
                  color={COLORS.darkGold}
                />
              ))}
            </View>
            <Text style={styles.summaryText}>
              {data.averageRating === null
                ? 'No ratings yet'
                : `${data.averageRating.toFixed(1)} · ${data.totalReviews} ${data.totalReviews === 1 ? 'review' : 'reviews'}`}
            </Text>
          </>
        )}
      </View>

      {error && !modalVisible ? <Text style={styles.errorText}>{error}</Text> : null}
      {!loading ? (
        <>
          {user ? (
            <TouchableOpacity
              style={styles.writeButton}
              onPress={() => openEditor(data.ownReview)}
              accessibilityRole="button"
            >
              <FontAwesome name={data.ownReview ? 'pencil' : 'star-o'} size={15} color={COLORS.darkNavy} />
              <Text style={styles.writeButtonText}>
                {data.ownReview ? 'Edit your review' : 'Write a review'}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.signInText}>Sign in to leave a review.</Text>
          )}

          {!error && data.reviews.length === 0 ? (
            <Text style={styles.emptyText}>Be the first to share how it turned out.</Text>
          ) : null}
          {!error && data.reviews.length > 0 ? (
            <View style={styles.reviewList}>
              {data.reviews.map(review => (
                <View key={`${review.userId}-${recipeId}`} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.authorName}>
                      {review.userId === user?.id ? 'You' : review.authorName || 'BiteWise cook'}
                    </Text>
                    <View style={styles.reviewStars}>
                      {Array.from({ length: review.rating }, (_, index) => (
                        <FontAwesome key={index} name="star" size={12} color={COLORS.darkGold} />
                      ))}
                    </View>
                  </View>
                  {review.comment ? <Text style={styles.comment}>{review.comment}</Text> : null}
                </View>
              ))}
              {data.totalReviews > data.reviews.length ? (
                <Text style={styles.moreText}>Showing the latest {data.reviews.length} reviews.</Text>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeEditor}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {prompt ? 'How did it turn out?' : data.ownReview ? 'Update your review' : 'Rate this recipe'}
                </Text>
                <TouchableOpacity onPress={closeEditor} accessibilityRole="button" accessibilityLabel="Close review">
                  <FontAwesome name="times" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalHint}>Your rating helps us find recipes you’ll enjoy.</Text>
              <View style={styles.ratingPicker}>
                {[1, 2, 3, 4, 5].map(star => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => {
                      setRating(star);
                      setError(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${star} ${star === 1 ? 'star' : 'stars'}`}
                    accessibilityState={{ selected: rating === star }}
                  >
                    <FontAwesome
                      name={star <= rating ? 'star' : 'star-o'}
                      size={34}
                      color={COLORS.darkGold}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.commentInput}
                value={comment}
                onChangeText={setComment}
                placeholder="Add a comment (optional)"
                placeholderTextColor={COLORS.textMuted}
                multiline
                maxLength={MAX_REVIEW_LENGTH}
                textAlignVertical="top"
                accessibilityLabel="Optional review comment"
              />
              <Text style={styles.characterCount}>{comment.length}/{MAX_REVIEW_LENGTH}</Text>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <TouchableOpacity
                style={[styles.submitButton, saving && styles.disabledButton]}
                onPress={() => void submitReview()}
                disabled={saving}
                accessibilityRole="button"
              >
                {saving ? <ActivityIndicator color={COLORS.cardWhite} /> : (
                  <Text style={styles.submitButtonText}>Save review</Text>
                )}
              </TouchableOpacity>
              {data.ownReview ? (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={removeReview}
                  disabled={saving}
                  accessibilityRole="button"
                >
                  <Text style={styles.deleteButtonText}>Delete review</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.skipButton} onPress={closeEditor} disabled={saving}>
                <Text style={styles.skipButtonText}>Maybe later</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.darkNavy, marginBottom: 12 },
  summary: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 10 },
  stars: { flexDirection: 'row', gap: 3 },
  summaryText: { fontSize: 14, fontWeight: '600', color: COLORS.textDark },
  writeButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: COLORS.lightYellow,
  },
  writeButtonText: { fontSize: 14, fontWeight: '700', color: COLORS.darkNavy },
  signInText: { fontSize: 13, color: COLORS.textMuted, marginTop: 10 },
  emptyText: { fontSize: 13, lineHeight: 19, color: COLORS.textMuted, marginTop: 12 },
  reviewList: { gap: 10, marginTop: 14 },
  reviewCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: COLORS.cardWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  authorName: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.darkNavy },
  reviewStars: { flexDirection: 'row', gap: 2 },
  comment: { fontSize: 14, lineHeight: 20, color: COLORS.textDark, marginTop: 7 },
  moreText: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginTop: 2 },
  errorText: { fontSize: 13, lineHeight: 19, color: COLORS.redAccent, marginTop: 10 },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  modalCard: {
    maxHeight: '90%',
    padding: 22,
    paddingBottom: 30,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: COLORS.background,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modalTitle: { flex: 1, fontSize: 22, fontWeight: '700', color: COLORS.darkNavy },
  modalHint: { fontSize: 14, color: COLORS.textMuted, lineHeight: 20, marginTop: 8 },
  ratingPicker: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 20 },
  commentInput: {
    minHeight: 104,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.cardWhite,
    color: COLORS.textDark,
    fontSize: 15,
  },
  characterCount: { fontSize: 11, color: COLORS.textMuted, textAlign: 'right', marginTop: 5 },
  submitButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: COLORS.darkNavy,
  },
  submitButtonText: { fontSize: 15, fontWeight: '700', color: COLORS.cardWhite },
  disabledButton: { opacity: 0.6 },
  deleteButton: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  deleteButtonText: { fontSize: 14, fontWeight: '600', color: COLORS.redAccent },
  skipButton: { alignItems: 'center', paddingVertical: 10 },
  skipButtonText: { fontSize: 14, color: COLORS.textMuted },
});
