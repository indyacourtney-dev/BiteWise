import React, { useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View as RNView,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text, View } from '@/components/Themed';

type GameState = 'modeSelection' | 'category' | 'vibe' | 'results';
type GameMode = 'pantry' | 'weekly' | null;
type Category = 'protein' | 'carb' | 'greens';
type Vibe = 'spicy' | 'savory' | 'sweet';

interface Option {
  id: string;
  label: string;
  emoji: string;
  tags: string[];
}

interface Question {
  id: string;
  question: string;
  options: Option[];
}

interface CategoryData {
  name: string;
  questions: Question[];
}

interface PlateComposition {
  produce: number;
  protein: number;
  carbs: number;
  healthyFats: number;
}

interface RecipeResult {
  id: string;
  name: string;
  emoji: string;
  tags: string[];
  matchScore: number;
  vibe: Vibe;
  plate: PlateComposition;
  isBalanced: boolean;
  ingredients?: string[];
  suggestion?: string;
}

// =====================================================
// QUESTION DATA
// =====================================================

const CATEGORY_QUESTIONS: Record<Category, CategoryData> = {
  protein: {
    name: 'Proteins',
    questions: [
      {
        id: 'p1',
        question: 'What protein sounds best?',
        options: [
          { id: 'p1o1', label: 'Chicken', emoji: '🍗', tags: ['chicken', 'lean', 'poultry'] },
          { id: 'p1o2', label: 'Beef', emoji: '🥩', tags: ['beef', 'hearty', 'red-meat'] },
          { id: 'p1o3', label: 'Fish', emoji: '🐟', tags: ['fish', 'seafood', 'light'] },
        ],
      },
      {
        id: 'p2',
        question: 'How do you like it cooked?',
        options: [
          { id: 'p2o1', label: 'Grilled', emoji: '🔥', tags: ['grilled', 'smoky'] },
          { id: 'p2o2', label: 'Fried', emoji: '🍳', tags: ['fried', 'crispy'] },
          { id: 'p2o3', label: 'Baked', emoji: '🍖', tags: ['baked', 'tender'] },
        ],
      },
      {
        id: 'p3',
        question: 'Protein portion size?',
        options: [
          { id: 'p3o1', label: 'Light', emoji: '🥢', tags: ['light', 'portion-small'] },
          { id: 'p3o2', label: 'Regular', emoji: '🍽️', tags: ['regular', 'portion-medium'] },
          { id: 'p3o3', label: 'Hearty', emoji: '🍴', tags: ['hearty', 'portion-large'] },
        ],
      },
    ],
  },
  carb: {
    name: 'Carbohydrates',
    questions: [
      {
        id: 'c1',
        question: 'What carb are you craving?',
        options: [
          { id: 'c1o1', label: 'Rice', emoji: '🍚', tags: ['rice', 'grain'] },
          { id: 'c1o2', label: 'Pasta', emoji: '🍝', tags: ['pasta', 'noodles'] },
          { id: 'c1o3', label: 'Bread', emoji: '🍞', tags: ['bread', 'grain'] },
        ],
      },
      {
        id: 'c2',
        question: 'How heavy or light?',
        options: [
          { id: 'c2o1', label: 'Light & Fresh', emoji: '🥗', tags: ['light', 'fresh'] },
          { id: 'c2o2', label: 'Balanced', emoji: '⚖️', tags: ['balanced'] },
          { id: 'c2o3', label: 'Rich & Creamy', emoji: '🍨', tags: ['rich', 'creamy'] },
        ],
      },
      {
        id: 'c3',
        question: 'Carb portion size?',
        options: [
          { id: 'c3o1', label: 'Low-Carb', emoji: '📉', tags: ['low-carb'] },
          { id: 'c3o2', label: 'Normal', emoji: '📊', tags: ['normal-carb'] },
          { id: 'c3o3', label: 'Extra Carbs', emoji: '📈', tags: ['high-carb'] },
        ],
      },
    ],
  },
  greens: {
    name: 'Vegetables & Greens',
    questions: [
      {
        id: 'g1',
        question: 'What veggies appeal to you?',
        options: [
          { id: 'g1o1', label: 'Leafy Greens', emoji: '🥬', tags: ['greens', 'leafy'] },
          { id: 'g1o2', label: 'Roasted Veggies', emoji: '🥦', tags: ['roasted', 'warm'] },
          { id: 'g1o3', label: 'Fresh Salad', emoji: '🥗', tags: ['salad', 'fresh', 'raw'] },
        ],
      },
      {
        id: 'g2',
        question: 'Veggie cooking style?',
        options: [
          { id: 'g2o1', label: 'Raw & Crisp', emoji: '🌱', tags: ['raw', 'crisp'] },
          { id: 'g2o2', label: 'Lightly Cooked', emoji: '🥕', tags: ['lightly-cooked'] },
          { id: 'g2o3', label: 'Well Roasted', emoji: '🍠', tags: ['roasted', 'caramelized'] },
        ],
      },
      {
        id: 'g3',
        question: 'Veggie portion size?',
        options: [
          { id: 'g3o1', label: 'Small Side', emoji: '🤏', tags: ['veggies-small'] },
          { id: 'g3o2', label: 'Balanced', emoji: '👌', tags: ['veggies-balanced'] },
          { id: 'g3o3', label: 'Heavy on Greens', emoji: '💪', tags: ['veggies-large'] },
        ],
      },
    ],
  },
};

// =====================================================
// MOCK RECIPES WITH PLATE COMPOSITION & INGREDIENTS
// =====================================================

const MOCK_RECIPES: RecipeResult[] = [
  {
    id: '1',
    name: 'Grilled Chicken with Brown Rice & Broccoli',
    emoji: '🍗',
    tags: ['chicken', 'grilled', 'rice', 'grain', 'light', 'balanced'],
    matchScore: 0,
    vibe: 'savory',
    plate: { produce: 45, protein: 28, carbs: 22, healthyFats: 5 },
    isBalanced: true,
    ingredients: ['chicken', 'rice', 'broccoli', 'olive oil'],
  },
  {
    id: '2',
    name: 'Crispy Beef Tacos',
    emoji: '🌮',
    tags: ['beef', 'fried', 'crispy', 'bread', 'hearty', 'portion-large'],
    matchScore: 0,
    vibe: 'spicy',
    plate: { produce: 20, protein: 32, carbs: 40, healthyFats: 8 },
    isBalanced: false,
    ingredients: ['beef', 'tortillas', 'lettuce', 'tomato', 'cheese'],
    suggestion: 'Add more vegetables for a balanced plate',
  },
  {
    id: '3',
    name: 'Lemon Herb Fish with Roasted Vegetables',
    emoji: '🐟',
    tags: ['fish', 'seafood', 'light', 'baked', 'fresh', 'greens', 'raw'],
    matchScore: 0,
    vibe: 'savory',
    plate: { produce: 50, protein: 25, carbs: 18, healthyFats: 7 },
    isBalanced: true,
    ingredients: ['fish', 'vegetables', 'lemon', 'herbs', 'olive oil'],
  },
  {
    id: '4',
    name: 'Creamy Pasta Carbonara',
    emoji: '🍝',
    tags: ['pasta', 'noodles', 'rich', 'creamy', 'regular', 'high-carb'],
    matchScore: 0,
    vibe: 'savory',
    plate: { produce: 15, protein: 20, carbs: 55, healthyFats: 10 },
    isBalanced: false,
    ingredients: ['pasta', 'eggs', 'bacon', 'parmesan', 'cream'],
    suggestion: 'Add a side salad to boost vegetables to 50%',
  },
  {
    id: '5',
    name: 'Spicy Thai Curry with Jasmine Rice',
    emoji: '🍛',
    tags: ['rice', 'chicken', 'spicy', 'balanced', 'warm'],
    matchScore: 0,
    vibe: 'spicy',
    plate: { produce: 35, protein: 26, carbs: 32, healthyFats: 7 },
    isBalanced: false,
    ingredients: ['chicken', 'rice', 'vegetables', 'coconut milk', 'curry paste'],
    suggestion: 'Increase vegetables to reach 50% for optimal balance',
  },
  {
    id: '6',
    name: 'Vibrant Garden Salad Bowl',
    emoji: '🥗',
    tags: ['salad', 'fresh', 'greens', 'leafy', 'light', 'raw', 'veggies-balanced'],
    matchScore: 0,
    vibe: 'savory',
    plate: { produce: 55, protein: 20, carbs: 15, healthyFats: 10 },
    isBalanced: true,
    ingredients: ['lettuce', 'vegetables', 'chicken', 'olive oil', 'vinegar'],
  },
  {
    id: '7',
    name: 'Grilled Beef Steak with Sweet Potato',
    emoji: '🥩',
    tags: ['beef', 'hearty', 'grilled', 'red-meat', 'portion-large'],
    matchScore: 0,
    vibe: 'savory',
    plate: { produce: 30, protein: 35, carbs: 28, healthyFats: 7 },
    isBalanced: false,
    ingredients: ['beef', 'sweet potato', 'vegetables', 'olive oil'],
    suggestion: 'Add roasted vegetables to balance the plate',
  },
  {
    id: '8',
    name: 'Sweet & Sour Chicken with Brown Rice',
    emoji: '🍲',
    tags: ['chicken', 'sweet', 'poultry', 'rice'],
    matchScore: 0,
    vibe: 'sweet',
    plate: { produce: 40, protein: 27, carbs: 26, healthyFats: 7 },
    isBalanced: true,
    ingredients: ['chicken', 'rice', 'vegetables', 'soy sauce', 'pineapple'],
  },
];

// =====================================================
// HELPERS
// =====================================================

function calculateMatchScore(userTags: Set<string>, recipeTags: string[]): number {
  if (userTags.size === 0) return 50;
  const matches = recipeTags.filter(tag => userTags.has(tag)).length;
  return Math.round((matches / recipeTags.length) * 100);
}

// =====================================================
// PLATE VISUALIZATION COMPONENT
// =====================================================

const PlateVisualization: React.FC<{ plate: PlateComposition; isBalanced: boolean }> = ({
  plate,
  isBalanced,
}) => {
  return (
    <View style={styles.plateContainer}>
      <View style={styles.plateCircle}>
        <View style={[styles.plateSection, styles.produceSection, { flex: plate.produce / 50 }]}>
          <Text style={styles.plateSectionLabel}>🥗</Text>
        </View>
        <View style={[styles.plateSection, styles.proteinSection, { flex: plate.protein / 25 }]}>
          <Text style={styles.plateSectionLabel}>🍗</Text>
        </View>
        <View style={[styles.plateSection, styles.carbsSection, { flex: plate.carbs / 25 }]}>
          <Text style={styles.plateSectionLabel}>🍚</Text>
        </View>
        {plate.healthyFats > 0 && (
          <View style={[styles.plateSection, styles.fatsSection]}>
            <Text style={styles.plateSectionLabel}>🫒</Text>
          </View>
        )}
      </View>

      <View style={styles.plateBreakdown}>
        <View style={styles.breakdownRow}>
          <View style={[styles.breakdownDot, { backgroundColor: '#52C41A' }]} />
          <Text style={styles.breakdownText}>Produce {plate.produce}%</Text>
        </View>
        <View style={styles.breakdownRow}>
          <View style={[styles.breakdownDot, { backgroundColor: '#FF4D4F' }]} />
          <Text style={styles.breakdownText}>Protein {plate.protein}%</Text>
        </View>
        <View style={styles.breakdownRow}>
          <View style={[styles.breakdownDot, { backgroundColor: '#FAAD14' }]} />
          <Text style={styles.breakdownText}>Carbs {plate.carbs}%</Text>
        </View>
        <View style={styles.breakdownRow}>
          <View style={[styles.breakdownDot, { backgroundColor: '#D4AF37' }]} />
          <Text style={styles.breakdownText}>Healthy Fats {plate.healthyFats}%</Text>
        </View>
      </View>

      <View style={[styles.balanceStatus, isBalanced ? styles.balancedBG : styles.unbalancedBG]}>
        <FontAwesome
          name={isBalanced ? 'check-circle' : 'exclamation-circle'}
          size={16}
          color={isBalanced ? '#52C41A' : '#FF9C6E'}
        />
        <Text style={[styles.balanceText, isBalanced ? styles.balancedText : styles.unbalancedText]}>
          {isBalanced ? 'Balanced Plate' : 'Tip: Add more produce'}
        </Text>
      </View>
    </View>
  );
};

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function ThisOrThatScreen() {
  const router = useRouter();

  const [gameState, setGameState] = useState<GameState>('modeSelection');
  const [gameMode, setGameMode] = useState<GameMode>(null);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(null);

  const [currentCategory, setCurrentCategory] = useState<Category>('protein');
  const [categoryIndex, setCurrentCategoryIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);

  const categories: Category[] = ['protein', 'carb', 'greens'];

  // =====================================================
  // HANDLERS
  // =====================================================

  const handleModeSelect = (mode: GameMode) => {
    setGameMode(mode);
    setGameState('category');
    setCurrentCategory('protein');
    setCurrentCategoryIndex(0);
    setQuestionIndex(0);
  };

  const handleSelectOption = (option: Option) => {
    const newTags = new Set(selectedTags);
    option.tags.forEach(tag => newTags.add(tag));
    setSelectedTags(newTags);
    moveToNextQuestion();
  };

  const handleSkipQuestion = () => {
    moveToNextQuestion();
  };

  const moveToNextQuestion = () => {
    const currentCategoryData = CATEGORY_QUESTIONS[currentCategory];

    if (questionIndex < currentCategoryData.questions.length - 1) {
      setQuestionIndex(questionIndex + 1);
    } else if (categoryIndex < categories.length - 1) {
      const nextCategoryIndex = categoryIndex + 1;
      setCurrentCategoryIndex(nextCategoryIndex);
      setCurrentCategory(categories[nextCategoryIndex]);
      setQuestionIndex(0);
    } else {
      setGameState('vibe');
    }
  };

  const handleSelectVibe = (vibe: Vibe) => {
    setSelectedVibe(vibe);
    setGameState('results');
  };

  const handlePlayAgain = () => {
    setGameState('modeSelection');
    setGameMode(null);
    setSelectedTags(new Set());
    setSelectedVibe(null);
    setCurrentCategory('protein');
    setCurrentCategoryIndex(0);
    setQuestionIndex(0);
  };

  const handleExit = () => {
    router.push('/(tabs)/index');
  };

  // =====================================================
  // MODE SELECTION SCREEN
  // =====================================================

  if (gameState === 'modeSelection') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.modeContent}>
          <View style={styles.modeHeader}>
            <Text style={styles.modeTitle}>How Do You Want to Meal Plan?</Text>
            <Text style={styles.modeSubtitle}>
              Choose based on your cooking goals right now
            </Text>
          </View>

          {/* PANTRY MODE */}
          <TouchableOpacity
            style={styles.modeCard}
            onPress={() => handleModeSelect('pantry')}
            activeOpacity={0.85}
          >
            <View style={styles.modeCardContent}>
              <Text style={styles.modeCardEmoji}>🥘</Text>
              <View style={styles.modeCardText}>
                <Text style={styles.modeCardTitle}>Use My Pantry</Text>
                <Text style={styles.modeCardDesc}>
                  Find recipes with what you have in your kitchen right now
                </Text>
              </View>
              <FontAwesome name="arrow-right" size={20} color="#b49221" />
            </View>
          </TouchableOpacity>

          {/* WEEKLY PLANNING MODE */}
          <TouchableOpacity
            style={styles.modeCard}
            onPress={() => handleModeSelect('weekly')}
            activeOpacity={0.85}
          >
            <View style={styles.modeCardContent}>
              <Text style={styles.modeCardEmoji}>📅</Text>
              <View style={styles.modeCardText}>
                <Text style={styles.modeCardTitle}>Plan for the Week</Text>
                <Text style={styles.modeCardDesc}>
                  Discover balanced meals to plan your week ahead
                </Text>
              </View>
              <FontAwesome name="arrow-right" size={20} color="#b49221" />
            </View>
          </TouchableOpacity>

          {/* INFO CARD */}
          <View style={styles.plateInfoCard}>
            <Text style={styles.plateInfoTitle}>🍽️ Harvard Healthy Eating Plate</Text>
            <Text style={styles.plateInfoText}>
              All recipes are designed around this balanced nutrition model:
            </Text>
            <View style={styles.plateInfoList}>
              <Text style={styles.plateInfoItem}>
                <Text style={styles.plateInfoBold}>50% Produce:</Text> Vegetables & fruits
              </Text>
              <Text style={styles.plateInfoItem}>
                <Text style={styles.plateInfoBold}>25% Protein:</Text> Lean meat, fish, beans
              </Text>
              <Text style={styles.plateInfoItem}>
                <Text style={styles.plateInfoBold}>25% Carbs:</Text> Whole grains
              </Text>
              <Text style={styles.plateInfoItem}>
                <Text style={styles.plateInfoBold}>Healthy Fats:</Text> Olive oil, nuts, seeds
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // =====================================================
  // CATEGORY QUESTION SCREEN
  // =====================================================

  if (gameState === 'category') {
    const categoryData = CATEGORY_QUESTIONS[currentCategory];
    const question = categoryData.questions[questionIndex];

    const totalQuestions = categories.reduce(
      (sum, cat) => sum + CATEGORY_QUESTIONS[cat].questions.length,
      0
    );
    const questionsCompleted = categoryIndex * 3 + questionIndex;
    const progressPercent = (questionsCompleted / totalQuestions) * 100;

    const modeLabel = gameMode === 'pantry' ? 'My Pantry' : 'Weekly Plan';

    return (
      <View style={styles.container}>
        <View style={styles.questionHeader}>
          <TouchableOpacity onPress={handleExit} style={styles.exitBtn}>
            <FontAwesome name="times" size={20} color="#2e4053" />
          </TouchableOpacity>

          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>

          <View style={styles.progressInfo}>
            <Text style={styles.modeLabel}>{modeLabel}</Text>
            <Text style={styles.progressText}>
              Q{questionsCompleted + 1} of {totalQuestions}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.questionContent}>
          <Text style={styles.question}>{question.question}</Text>

          <View style={styles.optionsContainer}>
            {question.options.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={styles.optionCard}
                onPress={() => handleSelectOption(option)}
                activeOpacity={0.8}
              >
                <Text style={styles.optionEmoji}>{option.emoji}</Text>
                <Text style={styles.optionLabel}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={styles.skipBtn}
          onPress={handleSkipQuestion}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Skip this question</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // =====================================================
  // VIBE SELECTION SCREEN
  // =====================================================

  if (gameState === 'vibe') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.vibeContent}>
          <View style={styles.vibeHeader}>
            <Text style={styles.vibeTitle}>What's Your Vibe?</Text>
            <Text style={styles.vibeSubtitle}>How do you want your meal to taste?</Text>
          </View>

          <View style={styles.vibeOptions}>
            <TouchableOpacity
              style={styles.vibeCard}
              onPress={() => handleSelectVibe('spicy')}
              activeOpacity={0.8}
            >
              <Text style={styles.vibeEmoji}>🌶️</Text>
              <Text style={styles.vibeName}>Spicy</Text>
              <Text style={styles.vibeDesc}>Kick it up</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.vibeCard}
              onPress={() => handleSelectVibe('savory')}
              activeOpacity={0.8}
            >
              <Text style={styles.vibeEmoji}>🍲</Text>
              <Text style={styles.vibeName}>Savory</Text>
              <Text style={styles.vibeDesc}>Classic flavors</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.vibeCard}
              onPress={() => handleSelectVibe('sweet')}
              activeOpacity={0.8}
            >
              <Text style={styles.vibeEmoji}>🍯</Text>
              <Text style={styles.vibeName}>Sweet</Text>
              <Text style={styles.vibeDesc}>A little sweetness</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // =====================================================
  // RESULTS SCREEN
  // =====================================================

  const recipesWithScores = MOCK_RECIPES.map(recipe => ({
    ...recipe,
    matchScore: calculateMatchScore(selectedTags, recipe.tags),
  }))
    .filter(r => r.matchScore >= 70 && (selectedVibe ? r.vibe === selectedVibe : true))
    .sort((a, b) => b.matchScore - a.matchScore);

  const modeLabel = gameMode === 'pantry' ? 'Using My Pantry' : 'Week Planner';
  const modeSubtext =
    gameMode === 'pantry'
      ? 'Based on ingredients you have right now'
      : 'Perfect meals to plan for your week';

  return (
    <View style={styles.container}>
      <View style={styles.resultsHeader}>
        <TouchableOpacity onPress={handleExit} style={styles.exitBtn}>
          <FontAwesome name="times" size={20} color="#2e4053" />
        </TouchableOpacity>
        <View>
          <Text style={styles.resultsTitle}>Your Recipe Matches</Text>
          <Text style={styles.resultsSubmode}>{modeSubtext}</Text>
        </View>
        <RNView style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.resultsContent}>
        {recipesWithScores.length === 0 ? (
          <View style={styles.noResults}>
            <Text style={styles.noResultsEmoji}>😕</Text>
            <Text style={styles.noResultsText}>
              No recipes matched your preferences
            </Text>
            <Text style={styles.noResultsSubtext}>Try different selections</Text>
          </View>
        ) : (
          recipesWithScores.map(recipe => (
            <TouchableOpacity
              key={recipe.id}
              style={styles.resultCard}
              activeOpacity={0.85}
            >
              <View style={styles.resultCardHeader}>
                <RNView style={styles.resultInfo}>
                  <Text style={styles.resultName}>{recipe.name}</Text>
                  <View style={styles.matchScoreBar}>
                    <View
                      style={[
                        styles.matchScoreFill,
                        { width: `${recipe.matchScore}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.matchPercent}>{recipe.matchScore}% match</Text>
                </RNView>
                <Text style={styles.resultEmoji}>{recipe.emoji}</Text>
              </View>

              <PlateVisualization
                plate={recipe.plate}
                isBalanced={recipe.isBalanced}
              />

              {recipe.suggestion && (
                <View style={styles.suggestionBox}>
                  <FontAwesome name="lightbulb-o" size={14} color="#FF9C6E" />
                  <Text style={styles.suggestionText}>{recipe.suggestion}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <View style={styles.resultsActions}>
        <TouchableOpacity
          style={styles.playAgainBtn}
          onPress={handlePlayAgain}
          activeOpacity={0.9}
        >
          <FontAwesome name="refresh" size={16} color="#ffffff" />
          <Text style={styles.playAgainText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f6fd',
  },

  // MODE SELECTION SCREEN
  modeContent: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    paddingBottom: 60,
  },
  modeHeader: {
    marginBottom: 32,
  },
  modeTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2e4053',
    marginBottom: 8,
  },
  modeSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  modeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    marginBottom: 14,
    borderColor: '#e0e0e0',
    borderWidth: 1,
    overflow: 'hidden',
  },
  modeCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 14,
  },
  modeCardEmoji: {
    fontSize: 44,
  },
  modeCardText: {
    flex: 1,
  },
  modeCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2e4053',
    marginBottom: 4,
  },
  modeCardDesc: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },

  // Plate Info Card
  plateInfoCard: {
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: '#52C41A',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 10,
    marginTop: 24,
  },
  plateInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2e4053',
    marginBottom: 8,
  },
  plateInfoText: {
    fontSize: 13,
    color: '#333',
    marginBottom: 12,
    lineHeight: 18,
  },
  plateInfoList: {
    gap: 8,
  },
  plateInfoItem: {
    fontSize: 12,
    color: '#333',
    lineHeight: 16,
  },
  plateInfoBold: {
    fontWeight: '700',
  },

  // QUESTION SCREEN
  questionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exitBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: '#e0e0e0',
    borderWidth: 1,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#b49221',
  },
  progressInfo: {
    width: 70,
  },
  modeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#b49221',
    textTransform: 'uppercase',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2e4053',
  },
  questionContent: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    paddingBottom: 120,
  },
  question: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2e4053',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 32,
  },
  optionsContainer: {
    gap: 14,
  },
  optionCard: {
    backgroundColor: '#ffffff',
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    borderColor: '#e0e0e0',
    borderWidth: 1,
  },
  optionEmoji: {
    fontSize: 44,
    marginBottom: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2e4053',
  },
  skipBtn: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },

  // VIBE SCREEN
  vibeContent: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    paddingBottom: 60,
  },
  vibeHeader: {
    marginBottom: 32,
  },
  vibeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2e4053',
    marginBottom: 8,
  },
  vibeSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  vibeOptions: {
    gap: 14,
  },
  vibeCard: {
    backgroundColor: '#ffffff',
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    borderColor: '#e0e0e0',
    borderWidth: 1,
  },
  vibeEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  vibeName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2e4053',
    marginBottom: 4,
  },
  vibeDesc: {
    fontSize: 13,
    color: '#999',
  },

  // RESULTS SCREEN
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2e4053',
  },
  resultsSubmode: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  resultsContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 100,
  },
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
    borderColor: '#e0e0e0',
    borderWidth: 1,
  },
  resultCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2e4053',
    marginBottom: 6,
  },
  matchScoreBar: {
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  matchScoreFill: {
    height: '100%',
    backgroundColor: '#b49221',
  },
  matchPercent: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
  },
  resultEmoji: {
    fontSize: 32,
  },

  // Plate Visualization
  plateContainer: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  plateCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    flexDirection: 'row',
    alignSelf: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  plateSection: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  produceSection: {
    backgroundColor: '#52C41A',
    flex: 1,
  },
  proteinSection: {
    backgroundColor: '#FF4D4F',
    flex: 1,
  },
  carbsSection: {
    backgroundColor: '#FAAD14',
    flex: 1,
  },
  fatsSection: {
    backgroundColor: '#D4AF37',
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plateSectionLabel: {
    fontSize: 16,
  },

  // Plate Breakdown
  plateBreakdown: {
    gap: 6,
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  breakdownText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },

  // Balance Status
  balanceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  balancedBG: {
    backgroundColor: '#F6FFED',
  },
  unbalancedBG: {
    backgroundColor: '#FFF7E6',
  },
  balanceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  balancedText: {
    color: '#52C41A',
  },
  unbalancedText: {
    color: '#FF9C6E',
  },

  // Suggestion Box
  suggestionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7E6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 14,
    marginBottom: 12,
  },
  suggestionText: {
    fontSize: 12,
    color: '#FF9C6E',
    fontWeight: '500',
    flex: 1,
  },

  // No Results
  noResults: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  noResultsEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2e4053',
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#999',
  },

  // Bottom Actions
  resultsActions: {
    position: 'absolute',
    bottom: 20,
    left: 24,
    right: 24,
  },
  playAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2e4053',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
  },
  playAgainText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
