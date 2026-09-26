
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { COLORS } from '@/constants/Colors';
import { homeStyles } from '@/styles/homeStyles';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import MealTypePicker from '@/components/MealTypePicker';
import Avatar from '@/components/Avatar';
import { useMyProfile } from '@/hooks/useMyProfile';
import { MEAL_INFO, QUIZ_MEAL_TYPES } from '@/utils/meals';
import { stockStatus } from '@/utils/pantryStatus';
import { todayIso } from '@/utils/age';
import { addDays } from '@/utils/weekPlan';

// Header section with greeting, brand label, and sign-out
const HeaderSection = ({
  userName,
  subtitle,
  onSignOut,
  onProfile,
  avatarUrl,
}: {
  userName: string;
  subtitle: string;
  onSignOut: () => void;
  onProfile: () => void;
  avatarUrl?: string | null;
}) => (
  <View style={homeStyles.headerContainer}>
    <View style={homeStyles.greetingRow}>
      <View style={homeStyles.waveIconContainer}>
        <Text style={homeStyles.waveEmoji}>👋</Text>
      </View>
      <View style={homeStyles.greetingTextContainer}>
        <Text style={homeStyles.greetingTitle}>Hey {userName}!</Text>
        <Text style={homeStyles.greetingSubtitle}>{subtitle}</Text>
      </View>
      {/* Profile: change diet, allergies and tastes any time. */}
      <TouchableOpacity
        onPress={onProfile}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Profile and settings"
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: COLORS.cardWhite,
          borderWidth: 1,
          borderColor: COLORS.borderLight,
          marginRight: 8,
        }}
      >
        {avatarUrl ? (
          <Avatar url={avatarUrl} size={34} label="Profile and settings" />
        ) : (
          <Ionicons name="person-circle-outline" size={22} color={COLORS.darkNavy} />
        )}
      </TouchableOpacity>
      {/* Sign out lives on Home so it's always one tap away. The auth
          gate notices the dropped session and returns to the login. */}
      <TouchableOpacity
        onPress={onSignOut}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: COLORS.cardWhite,
          borderWidth: 1,
          borderColor: COLORS.borderLight,
        }}
      >
        <Ionicons name="log-out-outline" size={20} color={COLORS.darkNavy} />
      </TouchableOpacity>
    </View>
    <Text style={homeStyles.brandLogo}>BiteWise</Text>
  </View>
);

// This-or-That game card (lunch & dinner: its questions are about protein/carbs/greens)
const FeaturedGameCard = ({ onStartGame }: { onStartGame: () => void }) => (
  <View style={homeStyles.heroCard}>
    <View style={homeStyles.clocheContainer}>
      <MaterialCommunityIcons name="silverware-fork-knife" size={42} color={COLORS.goldYellow} />
    </View>

    <Text style={homeStyles.heroTitle}>Craving something?</Text>
    <Text style={homeStyles.heroTitleHighlight}>Play "This or That!"</Text>
    <Text style={homeStyles.heroSubtitle}>
      Pick between two dishes a few times. Each round learns from your last tap.
    </Text>

    <TouchableOpacity style={homeStyles.heroButton} activeOpacity={0.8} onPress={onStartGame}>
      <Text style={homeStyles.heroButtonText}>Start Game</Text>
      <View style={homeStyles.heroButtonIconCircle}>
        <Ionicons name="arrow-forward" size={16} color={COLORS.goldYellow} />
      </View>
    </TouchableOpacity>
  </View>
);

// Running-low reminder: only shows when the pantry needs restocking or the
// list has things on it, and opens the Grocery tab.
const KitchenNudge = () => {
  const router = useRouter();
  const { pantry, grocery } = useApp();
  const listed = new Set(grocery.map(g => g.name.toLowerCase()));
  const low = pantry.filter(i => stockStatus(i) !== 'ok' && !listed.has(i.name.toLowerCase()));
  const toBuy = grocery.filter(g => !g.checked).length;
  if (low.length === 0 && toBuy === 0) return null;

  const names = low.slice(0, 2).map(i => i.name.toLowerCase());
  const more = low.length - names.length;
  const text =
    low.length > 0
      ? `You're low on ${names.join(names.length === 2 && more === 0 ? ' and ' : ', ')}${more > 0 ? ` and ${more} more` : ''}`
      : `${toBuy} item${toBuy === 1 ? '' : 's'} on your grocery list`;

  return (
    <TouchableOpacity
      onPress={() => router.push('/grocery')}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${text}. Open grocery list`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: COLORS.cardWhite,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: low.length > 0 ? '#EDE28A' : COLORS.borderLight,
        padding: 12,
        marginBottom: 18,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: low.length > 0 ? COLORS.lightYellow : COLORS.lightBlueBg,
        }}
      >
        <Text style={{ fontSize: 20 }}>{low.length > 0 ? low[0].icon : '🛒'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.darkNavy }} numberOfLines={2}>
          {text}
        </Text>
        <Text style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
          {low.length > 0 ? 'Add them to your grocery list' : 'Open your grocery list'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.darkNavy} />
    </TouchableOpacity>
  );
};

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
  const { profile: myProfile } = useMyProfile();
  const { preferences, mealType, setMealType, mealPlan } = useApp();

  // What the Plan my week card says: tonight's dinner if planned, else progress.
  const today = todayIso();
  const weekEnd = addDays(today, 6);
  const weekMeals = mealPlan.filter(m => m.date >= today && m.date <= weekEnd);
  const tonight = weekMeals.find(m => m.date === today && m.slot === 'dinner');
  const weekSummary = tonight
    ? `Tonight: ${tonight.name}`
    : weekMeals.length > 0
      ? `${weekMeals.length} meal${weekMeals.length === 1 ? '' : 's'} planned for the next 7 days`
      : 'See and plan your meals for the next 7 days';
  const quizMeal = QUIZ_MEAL_TYPES.includes(mealType);
  const { user, signOut } = useAuth();

  // The tab bar floats over screen content, so the scroll has to pad past
  // it or the last cards sit underneath it and can't be reached.
  const tabBarHeight = useBottomTabBarHeight();

  // Prefer the name they typed in onboarding, fall back to their
  // account username, then a friendly generic.
  const userName = preferences.name?.trim() || user?.user_metadata?.username || 'there';

  return (
    <SafeAreaView style={homeStyles.safeArea} edges={['top']}>
      <View style={homeStyles.topDiagonalBackground} />

      <ScrollView
        contentContainerStyle={[homeStyles.scrollContent, { paddingBottom: tabBarHeight + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <HeaderSection userName={userName} subtitle={MEAL_INFO[mealType].prompt}
          onSignOut={signOut}
          onProfile={() => router.push('/profile')}
          avatarUrl={myProfile?.avatarUrl}
        />

        {/* Which meal? Pre-selected from the time of day; every decider below uses it. */}
        <View style={{ marginBottom: 18 }}>
          <Text style={[homeStyles.sectionTitle, { marginBottom: 10 }]}>What are we eating?</Text>
          <MealTypePicker value={mealType} onChange={setMealType} />
        </View>

        <KitchenNudge />

        {quizMeal ? <FeaturedGameCard onStartGame={() => router.push('/thisorthat')} /> : null}

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
            borderColor="#EDE28A"
            onPress={() => router.push('/cookWithPantry')}
          />

          <Text style={homeStyles.orDividerText}>OR</Text>

          <QuickDeciderCard
            title={`Can't Decide? We'll Pick Your ${MEAL_INFO[mealType].label}`}
            iconName="head-question-outline"
            iconType="mci"
            bgColor={COLORS.cardWhite}
            buttonBgColor={COLORS.darkNavy}
            buttonIconColor={COLORS.cardWhite}
            borderColor={COLORS.borderLight}
            onPress={() => router.push('/decide')}
          />
        </View>

        {/* Plan my week — the next 7 days of meals (app/planWeek.tsx) */}
        <TouchableOpacity
          style={homeStyles.planWeekCard}
          activeOpacity={0.85}
          onPress={() => router.push('/planWeek')}
        >
          <View style={homeStyles.planWeekIconCircle}>
            <MaterialCommunityIcons name="calendar-week" size={26} color={COLORS.darkNavy} />
          </View>
          <View style={homeStyles.planWeekTextWrap}>
            <Text style={homeStyles.planWeekTitle}>Plan my week</Text>
            <Text style={homeStyles.planWeekSubtitle}>{weekSummary}</Text>
          </View>
          <View style={homeStyles.planWeekArrowCircle}>
            <Ionicons name="arrow-forward" size={18} color={COLORS.cardWhite} />
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
