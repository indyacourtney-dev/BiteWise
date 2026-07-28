import React from 'react';
import { View, Text, Image } from 'react-native';
import { mealCardStyles } from '../styles/mealCardStyles';

// Props passed into the meal card UI
interface MealDisplayCardProps {
  meal: {
    id: string;
    title: string;
    imageUrl: string;
    usedIngredientsCount: number;
    extraIngredientsRemaining: number;
    matchPercentage?: number;
    tags: Array<{ icon: string; name: string }>;
  };
  dynamicIngredientsCount: number;
}

// Renders a single meal suggestion card with match info and tags
export default function MealDisplayCard({ meal, dynamicIngredientsCount }: MealDisplayCardProps) {
  
  // Calculate match percentage from used vs total ingredients
  const totalRecipeIngredients = meal.usedIngredientsCount + meal.extraIngredientsRemaining;
  const calculatedPercentage = totalRecipeIngredients > 0 
    ? Math.round((meal.usedIngredientsCount / totalRecipeIngredients) * 100) 
    : 0;

  // Show a small overflow indicator when there are more tags than the visible preview
  const hiddenTagsCount = meal.tags.length - 3;
  
  // Cap the ingredient count to the pantry size so the UI stays consistent
  const standardUsedIngredients = Math.min(meal.usedIngredientsCount, dynamicIngredientsCount || meal.usedIngredientsCount);

  return (
    <View style={mealCardStyles.mealDisplayCardLayout}>
      {/* Meal image on the left */}
      <View style={mealCardStyles.imageContainer}>
        <Image 
          source={{ uri: meal.imageUrl }} 
          style={mealCardStyles.mealCardThumbnailPhoto}
          resizeMode="cover"
        />
      </View>
      
      {/* Main content on the right */}
      <View style={mealCardStyles.mealCardRightContentSection}>
        <View style={mealCardStyles.mealTitleRowGroup}>
          <Text style={mealCardStyles.mealCardHeadingNameText} numberOfLines={2}>
            {meal.title}
          </Text>
          
          {/* Match percentage badge */}
          <View style={mealCardStyles.percentageIndicatorWrapper}>
            <View style={mealCardStyles.circularDataRingBorder}>
              <Text style={mealCardStyles.ringPercentageText}>
                {meal.matchPercentage || calculatedPercentage}%
              </Text>
            </View>
            <Text style={mealCardStyles.matchSubLabelBadgeText}>Match</Text>
          </View>
        </View>

        {/* Visible tags with an overflow indicator */}
        <View style={mealCardStyles.ingredientChipsContainerRow}>
          {meal.tags.slice(0, 3).map((tag, idx) => (
            <View key={idx} style={mealCardStyles.singleChipBadge}>
              <Text style={mealCardStyles.chipPillLabelText}>
                {tag.icon} {tag.name}
              </Text>
            </View>
          ))}
          
          {/* Show how many tags are hidden when the list is longer */}
          {hiddenTagsCount > 0 && (
            <Text style={mealCardStyles.plusMoreRemainingText}>+{hiddenTagsCount} more</Text>
          )}
        </View>

        {/* Footer showing how many pantry ingredients are used */}
        <Text style={mealCardStyles.usesIngredientsFooterLabelCount}>
          Uses {standardUsedIngredients} of your ingredients
        </Text>
      </View>
    </View>
  );
}