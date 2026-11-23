import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { COLORS } from '@/constants/Colors';
import { chefTopicsForScreen, type ChefTopic } from '@/utils/chefHelp';

export default function ChefAssistant() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, initializing } = useAuth();
  const { hydrated, hasOnboarded, birthDate, birthDateChecked } = useApp();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ChefTopic | null>(null);
  const screen = pathname.split('/').filter(Boolean).pop() ?? '';
  const hidden = !user || initializing || !hydrated || !hasOnboarded || (birthDateChecked && !birthDate) ||
    ['/auth', '/onboarding', '/ageCheck', '/tour'].some(path => pathname === path || pathname.startsWith(path + '/'));

  if (hidden) return null;

  const goTo = (route: string) => {
    setOpen(false);
    setSelected(null);
    router.push(route as any);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.floating, { bottom: insets.bottom + 76 }]}
        activeOpacity={0.85}
        onPress={() => { setSelected(null); setOpen(true); }}
        accessibilityRole="button"
        accessibilityLabel="Open BiteWise chef assistant"
      >
        <FontAwesome name="cutlery" size={23} color={COLORS.darkNavy} />
        <Text style={styles.floatingLabel}>Chef</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={[styles.panel, { marginBottom: insets.bottom + 12 }]}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title}>BiteWise Chef</Text>
                <Text style={styles.subtitle}>Here to help you find your way</Text>
              </View>
              <TouchableOpacity onPress={() => setOpen(false)} accessibilityLabel="Close chef assistant" accessibilityRole="button" style={styles.close}>
                <FontAwesome name="times" size={18} color={COLORS.darkNavy} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <Text style={styles.message}>{selected ? selected.answer : 'Hey there! What can I help you with today?'}</Text>
              {selected?.route ? (
                <TouchableOpacity style={styles.action} onPress={() => goTo(selected.route!)} accessibilityRole="button">
                  <Text style={styles.actionText}>{selected.action ?? 'Go there'}  →</Text>
                </TouchableOpacity>
              ) : null}
              {selected ? (
                <TouchableOpacity onPress={() => setSelected(null)} style={styles.back} accessibilityRole="button">
                  <Text style={styles.backText}>← Other questions</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <Text style={styles.section}>POPULAR QUESTIONS</Text>
                  {chefTopicsForScreen(screen).map(topic => (
                    <TouchableOpacity key={topic.id} style={styles.topic} onPress={() => setSelected(topic)} accessibilityRole="button">
                      <Text style={styles.topicText}>{topic.question}</Text>
                      <FontAwesome name="chevron-right" size={12} color={COLORS.darkNavy} />
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floating: { position: 'absolute', right: 16, width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.goldYellow, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.cardWhite, elevation: 7, zIndex: 100 },
  floatingLabel: { fontSize: 10, fontWeight: '800', color: COLORS.darkNavy, marginTop: 2 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  panel: { marginHorizontal: 12, borderRadius: 22, backgroundColor: COLORS.background, maxHeight: '76%', overflow: 'hidden' },
  header: { padding: 18, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.lightYellow },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.darkNavy },
  subtitle: { fontSize: 12, marginTop: 4, color: COLORS.textMuted },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 0 },
  content: { padding: 16, paddingBottom: 24 },
  message: { fontSize: 15, lineHeight: 22, color: COLORS.darkNavy, backgroundColor: COLORS.cardWhite, padding: 16, borderRadius: 14, marginBottom: 14 },
  section: { fontSize: 11, fontWeight: '800', color: COLORS.textMuted, marginBottom: 10 },
  topic: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.cardWhite, padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.borderLight },
  topicText: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.darkNavy },
  action: { backgroundColor: COLORS.darkNavy, padding: 14, borderRadius: 12, alignItems: 'center' },
  actionText: { color: COLORS.cardWhite, fontSize: 14, fontWeight: '700' },
  back: { marginTop: 14, alignItems: 'center', padding: 10 },
  backText: { color: COLORS.darkNavy, fontWeight: '700' },
});
