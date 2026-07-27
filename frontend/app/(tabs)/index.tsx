import React from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';

import { Text, View } from '@/components/Themed';

const heroImage = 'https://www.figma.com/api/mcp/asset/c496edce-c61e-43fd-9837-d097e57151f5';
const navIconProfile = 'https://www.figma.com/api/mcp/asset/9d874550-8a05-4594-bc66-f762b02d501f';
const navIconHome = 'https://www.figma.com/api/mcp/asset/0ea94ff9-d2fd-490d-8b2f-a101b6403abc';
const navIconRandomize = 'https://www.figma.com/api/mcp/asset/c52784eb-2659-410d-95dc-fb802834e00e';
const navIconPantry = 'https://www.figma.com/api/mcp/asset/5ca99509-b654-4706-a0a8-d2782e8d5011';

export default function HomeScreen() {
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
        <Text style={styles.title}>Can’t Decide?</Text>
        <Text style={styles.subtitle}>Play “This or That!” and let the app help you choose.</Text>
      </View>

      <TouchableOpacity style={styles.ctaButton} activeOpacity={0.9}>
        <Text style={styles.ctaText}>Start now</Text>
      </TouchableOpacity>

      <View style={styles.bottomNav}>
        <View style={styles.navItemActive}>
          <Image source={{ uri: navIconHome }} style={styles.navIcon} />
          <Text style={styles.navLabelActive}>Home</Text>
        </View>
        <View style={styles.navItem}>
          <Image source={{ uri: navIconRandomize }} style={styles.navIcon} />
          <Text style={styles.navLabel}>Randomize</Text>
        </View>
        <View style={styles.navItem}>
          <Image source={{ uri: navIconPantry }} style={styles.navIcon} />
          <Text style={styles.navLabel}>My Pantry</Text>
        </View>
        <View style={styles.navItem}>
          <Image source={{ uri: navIconProfile }} style={styles.navIcon} />
          <Text style={styles.navLabel}>Profile</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f6fd',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 24,
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
  bottomNav: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    shadowColor: '#2e4053',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  navItemActive: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  navIcon: {
    width: 20,
    height: 20,
  },
  navLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  navLabelActive: {
    fontSize: 11,
    color: '#2e4053',
    fontWeight: '700',
  },
});
