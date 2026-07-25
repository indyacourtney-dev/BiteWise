// screens/thisorthat.tsx
//
// "This or That" flow:
//   1. Intro card
//   2. 3-question round (protein / carbohydrate / sides), skip allowed
//   3. Score existing recipes against collected preference tags
//   4. Show matching recipes (70%+ match) -> tap into full recipe
//
// Branch: thisorthat-ui

import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants/pantryData';
import ThisOrThatCard from '../components/ThisOrThatCard';
import { buildRound, ThisOrThatQuestion } from '../data/thisOrThatData';
import { RECIPES } from '../data/recipes';
import {
  createRoundState,
  recordAnswer,
  getAnsweredCount,
  collectPreferenceTags,
  scoreRecipes,
  ScorableRecipe,
  RoundState,
} from '../utils/thisOrThatEngine';

type Step = 'intro' | 'question' | 'results';

export default function ThisOrThatScreen() {
  const [step, setStep] = useState<Step>('intro');
  const [round] = useState<ThisOrThatQuestion[]>(() => buildRound(3));
  const [index, setIndex] = useState(0);
  const [roundState, setRoundState] = useState<RoundState>(createRoundState());

  const currentQuestion = round[index];

  const results = useMemo(() => {
    const tags = collectPreferenceTags(roundState);
    return scoreRecipes(RECIPES as ScorableRecipe[], tags);
  }, [roundState]);

  function handleChoose(choice: 'A' | 'B' | 'SKIP') {
    const nextState = recordAnswer(roundState, currentQuestion, choice);
    setRoundState(nextState);

    if (index + 1 < round.length) {
      setIndex(index + 1);
    } else {
      setStep('results');
    }
  }

  function reset() {
    setStep('intro');
    setIndex(0);
    setRoundState(createRoundState());
  }

  if (step === 'intro') {
    return (
      <ScrollView contentContainerStyle={{ paddingTop: 60, paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: COLORS.darkNavy }}>
            This or That
          </Text>
          <Text style={{ fontSize: 15, color: COLORS.darkNavy, opacity: 0.6, marginTop: 8 }}>
            Answer a few quick picks and we'll find a meal that matches — skip
            any question you don't have a preference on.
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: COLORS.darkNavy,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              marginTop: 28,
            }}
            onPress={() => setStep('question')}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
              Start
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (step === 'question') {
    return (
      <ScrollView contentContainerStyle={{ paddingTop: 60, paddingBottom: 40 }}>
        <ThisOrThatCard
          question={currentQuestion}
          questionNumber={index + 1}
          totalQuestions={round.length}
          onChoose={handleChoose}
        />
      </ScrollView>
    );
  }

  // step === 'results'
  const answered = getAnsweredCount(roundState);

  return (
    <ScrollView contentContainerStyle={{ paddingTop: 60, paddingBottom: 40 }}>
      <View style={{ paddingHorizontal: 24 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.darkNavy }}>
          {results.length > 0 ? 'Meals for you' : "Nothing matched — here's what's popular"}
        </Text>
        <Text style={{ fontSize: 14, color: COLORS.darkNavy, opacity: 0.5, marginTop: 4 }}>
          Based on {answered} of {round.length} answers
        </Text>

        {results.length === 0 ? (
          <Text style={{ marginTop: 20, color: COLORS.darkNavy, opacity: 0.6 }}>
            Try answering a couple of questions next time for a tailored match,
            or browse the full recipe list.
          </Text>
        ) : (
          results.map(({ recipe, score }) => (
            <TouchableOpacity
              key={recipe.id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                padding: 18,
                marginTop: 14,
                shadowColor: '#000',
                shadowOpacity: 0.06,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 3 },
              }}
              onPress={() => {
                // Navigate to your recipe detail screen with recipe.id
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.darkNavy }}>
                {recipe.name}
              </Text>
              <Text style={{ fontSize: 13, color: COLORS.darkNavy, opacity: 0.5, marginTop: 4 }}>
                {Math.round(score * 100)}% match
              </Text>
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity style={{ marginTop: 28, alignItems: 'center' }} onPress={reset}>
          <Text style={{ color: COLORS.darkNavy, opacity: 0.6, fontWeight: '600' }}>
            Play again
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
