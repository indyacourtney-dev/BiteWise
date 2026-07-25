// components/ThisOrThatCard.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '../constants/pantryData';
import { thisOrThatStyles as styles } from '../styles/thisOrThatStyles';
import { ThisOrThatQuestion } from '../data/thisOrThatData';

interface ThisOrThatCardProps {
  question: ThisOrThatQuestion;
  questionNumber: number;
  totalQuestions: number;
  onChoose: (choice: 'A' | 'B' | 'SKIP') => void;
}

export default function ThisOrThatCard({
  question,
  questionNumber,
  totalQuestions,
  onChoose,
}: ThisOrThatCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.progressText}>
        {questionNumber} of {totalQuestions}
      </Text>
      <Text style={styles.prompt}>{question.prompt}</Text>

      <View style={styles.optionsRow}>
        <TouchableOpacity
          style={styles.optionButton}
          onPress={() => onChoose('A')}
          activeOpacity={0.8}
        >
          <Text style={styles.optionLabel}>{question.optionA.label}</Text>
        </TouchableOpacity>

        <View style={styles.orDivider}>
          <Text style={styles.orText}>OR</Text>
        </View>

        <TouchableOpacity
          style={styles.optionButton}
          onPress={() => onChoose('B')}
          activeOpacity={0.8}
        >
          <Text style={styles.optionLabel}>{question.optionB.label}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.skipButton}
        onPress={() => onChoose('SKIP')}
        activeOpacity={0.7}
      >
        <Feather name="skip-forward" size={16} color={COLORS.darkNavy} />
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
    </View>
  );
}
