
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { COLORS } from '../../constants/Colors';
import { homeStyles } from '../../styles/homeStyles';
import { useApp } from '../../context/AppContext';

// Header section with greeting and brand label
const HeaderSection = ({ userName }: { userName: string }) => (
  <View style={homeStyles.headerContainer}>
    <View style={homeStyles.greetingRow}>
      <View style={homeStyles.waveIconContainer}>
        <Text style={homeStyles.waveEmoji}>👋</Text>
      </View>
      <View style={homeStyles.greetingTextContainer}>
        <Text style={homeStyles.greetingTitle}>Hey {userName}!</Text>
        <Text style={homeStyles.greetingSubtitle}>What's the vibe for dinner?</Text>
      </View>
    </View>
    <Text style={homeStyles.brandLogo}>BiteWise</Text>
  </View>
);

// Hero card for the quick game prompt
const FeaturedGameCard = ({ onStartGame }: { onStartGame: () => void }) => (
  <View style={homeStyles.heroCard}>
    <View style={homeStyles.clocheContainer}>
      <MaterialCommunityIcons name="silverware-fork-knife" size={42} color={COLORS.goldYellow} />
    </View>

    <Text style={homeStyles.heroTitle}>Can't Decide?</Text>
    <Text style={homeStyles.heroTitleHighlight}>Play "This or That!"</Text>
    <Text style={homeStyles.heroSubtitle}>Quick game to find your current craving</Text>

    <TouchableOpacity style={homeStyles.heroButton} activeOpacity={0.8} onPress={onStartGame}>
      <Text style={homeStyles.heroButtonText}>Start Game</Text>
      <View style={homeStyles.heroButtonIconCircle}>
        <Ionicons name="arrow-forward" size={16} color={COLORS.goldYellow} />
      </View>
    </TouchableOpacity>
  </View>
);

interface QuickDeciderCardProps {
  title: string;
  iconName: string;
  iconType: 'mci' | 'ionicons';
  bgColor: string;
  buttonBgColor: string;
  buttonIconColor: string;
  borderColor?: string;
  onPress: () => void;
}

const QuickDeciderCard: React.FC<QuickDeciderCardProps> = ({
  title,
  iconName,
  iconType,
  bgColor,
  buttonBgColor,
  buttonIconColor,
  borderColor,
  onPress,
}) => (
  <TouchableOpacity
    style={[
      homeStyles.deciderCard,
      { backgroundColor: bgColor },
      borderColor ? { borderWidth: 1, borderColor } : null,
    ]}
    activeOpacity={0.85}
    onPress={onPress}
  >
    <View style={homeStyles.deciderIconContainer}>
      {iconType === 'mci' ? (
        <MaterialCommunityIcons name={iconName as any} size={48} color={COLORS.darkNavy} />
      ) : (
        <Ionicons name={iconName as any} size={48} color={COLORS.darkNavy} />
      )}
    </View>

    <Text style={homeStyles.deciderTitle}>{title}</Text>

    <View style={[homeStyles.deciderArrowCircle, { backgroundColor: buttonBgColor }]}>
      <Ionicons name="arrow-forward" size={18} color={buttonIconColor} />
    </View>
  </TouchableOpacity>
);

// Main home screen layout
export default function Home() {
  const router = useRouter();
  const { preferences } = useApp();

  // Falls back to a friendly generic until the user sets a name in prefs.
  const userName = preferences.name?.trim() || 'there';

  return (
    <SafeAreaView style={homeStyles.safeArea}>
      <View style={homeStyles.topDiagonalBackground} />

      <ScrollView contentContainerStyle={homeStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <HeaderSection userName={userName} />

        {/* Start Game -> the quiz, not the pantry */}
        <FeaturedGameCard onStartGame={() => router.push('/thisorthat')} />

        <View style={homeStyles.sectionHeader}>
          <Text style={homeStyles.sectionTitle}>
            Quick Deciders <Text style={homeStyles.sparkleEmoji}>✨</Text>
          </Text>
          <Text style={homeStyles.sectionSubtitle}>Let us help you get cooking.</Text>
        </View>

        <View style={homeStyles.decidersRow}>
          <QuickDeciderCard
            title="Cook with My Pantry"
            iconName="fridge-outline"
            iconType="mci"
            bgColor={COLORS.lightYellow}
            buttonBgColor={COLORS.goldYellow}
            buttonIconColor={COLORS.darkNavy}
            borderColor="#FBE396"
            onPress={() => router.push('/pantry')}
          />

          <Text style={homeStyles.orDividerText}>OR</Text>

          <QuickDeciderCard
            title="Surprise Me — Pick a Meal at Random"
            iconName="dice-5-outline"
            iconType="mci"
            bgColor={COLORS.cardWhite}
            buttonBgColor={COLORS.darkNavy}
            buttonIconColor={COLORS.cardWhite}
            borderColor={COLORS.borderLight}
            onPress={() => router.push('/randomMeal')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
