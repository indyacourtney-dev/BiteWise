import React from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

import { Text, View } from '@/components/Themed';

const heroImage = 'https://www.figma.com/api/mcp/asset/c496edce-c61e-43fd-9837-d097e57151f5';

export default function HomeScreen() {
  const router = useRouter();

  const handleStartGame = () => {
    // Navigate to This or That game screen
    router.push('/(tabs)/thisorthat');
  };

  const handlePantryAccess = () => {
    // Navigate to Pantry
    router.push('/(tabs)/two');
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.brand}>BiteWise</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>Fresh picks</Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <Image source={{ uri: heroImage }} style={styles.heroImage} resizeMode="cover" />
      </View>

      <View style={styles.copyWrap}>
        <Text style={styles.title}>Can't Decide?</Text>
        <Text style={styles.subtitle}>Play "This or That!" and let the app help you choose.</Text>
      </View>

      {/* PRIMARY CTA - Goes to This or That Game */}
      <TouchableOpacity 
        style={styles.ctaButton} 
        activeOpacity={0.9}
        onPress={handleStartGame}
      >
        <Text style={styles.ctaText}>Start now</Text>
      </TouchableOpacity>

      {/* SECONDARY CTA - Quick access to Pantry */}
      <TouchableOpacity 
        style={styles.secondaryCta}
        activeOpacity={0.85}
        onPress={handlePantryAccess}
      >
        <Text style={styles.secondaryCtaText}>Or add ingredients to your pantry</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f6fd',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 100, // Extra space for tab bar
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  brand: {
    fontSize: 34,
    fontWeight: '700',
    color: '#b49221',
    letterSpacing: 0.4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#2e4053',
  },
  statusText: {
    color: '#f3dd39',
    fontSize: 12,
    fontWeight: '600',
  },
  heroCard: {
    width: '100%',
    maxWidth: 320,
    height: 280,
    borderRadius: 28,
    overflow: 'hidden',
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#2e4053',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  copyWrap: {
    marginTop: 26,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2e4053',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#2e4053',
    opacity: 0.78,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 24,
  },
  ctaButton: {
    marginTop: 24,
    alignSelf: 'center',
    backgroundColor: '#2e4053',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryCta: {
    marginTop: 16,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryCtaText: {
    color: '#2e4053',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
