// constants/help.ts — one place for "what is this and how do I use it".
//
// Feeds two things so they never drift:
//   * the guided tour after onboarding (app/tour.tsx) — the cards marked
//     `tour`, in order
//   * the little "?" beside each feature (components/Help.tsx HelpButton),
//     and the Help screen that lists everything (app/help.tsx)
//
// Write for someone who has never seen the app: short, concrete, second
// person. No internals. Nothing here mentions why the birthday is asked.

import type { ComponentProps } from 'react';
import type FontAwesome from '@expo/vector-icons/FontAwesome';

export type HelpTopicId =
  | 'home' | 'decide' | 'thisOrThat' | 'kitchen' | 'pantry' | 'grocery' | 'plan'
  | 'recipe' | 'cooking' | 'saved' | 'community' | 'drinks' | 'profile' | 'goals';

export type HelpTone = 'sand' | 'clay' | 'sage' | 'navy' | 'yellow';

export interface HelpTopic {
  id: HelpTopicId;
  title: string;
  emoji: string;
  icon: ComponentProps<typeof FontAwesome>['name'];
  tone: HelpTone;
  /** One sentence: what it's for. */
  summary: string;
  /** How to use it, in order. Keep to 3–4. */
  steps: string[];
  /** Nice-to-know. Optional. */
  tips?: string[];
  /** Where it lives, for the Help screen ("Home tab", "Profile"). */
  where: string;
}

export const HELP_TOPICS: Record<HelpTopicId, HelpTopic> = {
  home: {
    id: 'home', title: 'Home', emoji: '🏠', icon: 'home', tone: 'sand', where: 'Home tab',
    summary: 'One answer to “what should I eat?”, ready when you open the app.',
    steps: [
      'Pick the meal at the top — breakfast, lunch, dinner, dessert.',
      'The big card is tonight’s pick, with the reasons it was chosen for you.',
      'Tap Cook this to open it, or Swap for the next best.',
      'Below it: other ways to decide, drinks, and what your kitchen needs.',
    ],
    tips: ['Picks respect your allergies and diets always, and your tastes most of the time.'],
  },
  decide: {
    id: 'decide', title: 'Pick for me', emoji: '🎯', icon: 'magic', tone: 'clay', where: 'Home → Pick for me',
    summary: 'When you can’t choose: one dish at a time, with the why.',
    steps: [
      'Tap a mood — Quick, Comforting, Healthy, Spicy — or leave it on Anything.',
      'Read why it fits: ingredients you have, foods you love, a balanced plate.',
      'Not tonight? Tap it and the next best appears. After three, you get the best three to settle it.',
      'Let’s make this opens the recipe; Save for later keeps it in Saved.',
    ],
    tips: ['Foods you said you’d rather skip still come up now and then, just less. Allergies never do.'],
  },
  thisOrThat: {
    id: 'thisOrThat', title: 'This or That', emoji: '⚔️', icon: 'random', tone: 'navy', where: 'Home → This or That',
    summary: 'A quick game of head-to-heads that ends with one meal to make.',
    steps: [
      'Two dishes appear. Tap the one you’d rather eat right now.',
      'The winner stays and faces the next challenger.',
      'After a few rounds you get your match — and the app learns what you lean toward.',
    ],
  },
  kitchen: {
    id: 'kitchen', title: 'Kitchen', emoji: '🧺', icon: 'cutlery', tone: 'sage', where: 'Kitchen tab',
    summary: 'Your pantry and your grocery list, side by side — things move between them.',
    steps: [
      'Pantry is what you have. Grocery is what to buy.',
      'When something runs low in the pantry, it can go on the list in one tap.',
      'Tick things off at the store and they go back into the pantry.',
      '“What can I make?” turns what you have into meals.',
    ],
  },
  pantry: {
    id: 'pantry', title: 'Pantry', emoji: '🥚', icon: 'archive', tone: 'sage', where: 'Kitchen → Pantry',
    summary: 'What’s in your kitchen, in plain words — so picks and lists can use it.',
    steps: [
      'Add: type a name (other names work — “scallions” finds Green Onions) or tap a staple.',
      'Tap − as you use things up. Each row says what’s left: “2 eggs left of 12 · running low”.',
      'Running low, out, or past its best floats to the top with the fix right there.',
      'Tap a row for details: where to keep it, how long it lasts, what it usually contains.',
    ],
    tips: ['Salt, pepper and water are always assumed to be in your kitchen.'],
  },
  grocery: {
    id: 'grocery', title: 'Grocery list', emoji: '🛒', icon: 'shopping-cart', tone: 'yellow', where: 'Kitchen → Grocery',
    summary: 'One list, filled from your pantry, your recipes and your week.',
    steps: [
      '“Running low at home” shows pantry items to restock — tap to add, or Add all.',
      'Recipes add their missing ingredients; the week plan adds a whole week’s worth.',
      'Type anything else at the top.',
      'Tick items off as you shop; they land back in your pantry as stocked.',
    ],
  },
  plan: {
    id: 'plan', title: 'Plan your week', emoji: '📅', icon: 'calendar', tone: 'navy', where: 'Plan tab',
    summary: 'Seven days of meals, balanced across the week, planned in a tap or two.',
    steps: [
      'Fill plans every empty slot for the days you’re cooking — varied proteins, balanced plates.',
      'Tap a slot to swap it, pick from Saved, or search.',
      'Mark a day Leftovers, Takeout or No cooking and the plan works around it.',
      'Add the week to your grocery list when you’re happy with it.',
    ],
    tips: ['Your plan is on your account, so it’s the same on every device you use.'],
  },
  recipe: {
    id: 'recipe', title: 'A recipe page', emoji: '📖', icon: 'book', tone: 'sand', where: 'Any recipe',
    summary: 'Everything to decide and to cook, with your kitchen in mind.',
    steps: [
      'Change servings and every amount updates.',
      'Ingredients you have are ticked; tap Add for the ones you don’t and they go on your list.',
      'Plate balance shows how the dish is built; “Round it out” suggests a side.',
      'Start cooking walks you through it. Add to my week puts it in your plan.',
    ],
    tips: ['Set a goal in Profile and each recipe shows how a serving fits it.'],
  },
  cooking: {
    id: 'cooking', title: 'Guided cooking', emoji: '👩‍🍳', icon: 'play', tone: 'clay', where: 'Recipe → Start cooking',
    summary: 'One step at a time, big enough to read from across the counter.',
    steps: [
      'Swipe or tap Next through the steps; the amounts for that step are right there.',
      'Steps with a time get a timer — tap to start it.',
      'Read this step speaks it aloud (voice and speed are in Accessibility).',
      'Done at the end asks how it went, so picks get better.',
    ],
  },
  saved: {
    id: 'saved', title: 'Saved', emoji: '❤️', icon: 'heart', tone: 'clay', where: 'Saved tab',
    summary: 'Recipes you’ve hearted, ready to cook or plan again.',
    steps: [
      'Tap the heart on any recipe to save it.',
      'Saved recipes show up first when you fill a slot in your week.',
      'Tap one to cook it. Tap the heart again to remove it.',
    ],
  },
  community: {
    id: 'community', title: 'Community', emoji: '💬', icon: 'comments', tone: 'yellow', where: 'Community tab',
    summary: 'Home recipes from other people, reviews, and rooms to talk food.',
    steps: [
      'Share a recipe of your own — it’s checked against your allergies like any other.',
      'Rate and review what you cooked; your reviews teach the app your taste.',
      'Join a room to swap ideas, and send a recipe straight into the chat.',
    ],
  },
  drinks: {
    id: 'drinks', title: 'Drinks', emoji: '🥤', icon: 'glass', tone: 'sage', where: 'Home → Drinks',
    summary: 'A section of its own: mocktails, smoothies, coffees, cozy cups and more.',
    steps: [
      'Tonight’s drink is picked for you; the list below is everything that fits your account.',
      'With what I have shows drinks you can make right now.',
      'Low effort is two ingredients and a glass; For a crowd makes a pitcher.',
      'Drinks stay out of your meal picks and week plan.',
    ],
  },
  profile: {
    id: 'profile', title: 'Profile & settings', emoji: '👤', icon: 'user', tone: 'navy', where: 'Home → your photo',
    summary: 'Your tastes, your goal, your account — change anything, any time.',
    steps: [
      'Your tastes: Never (allergies, diets, foods you’ve banned), Loves, and Less often.',
      'Set a fitness goal and picks and portions lean that way.',
      'Accessibility: text size, bold text, reduce motion, the read-aloud voice.',
      'Help & how it works brings you back here, and you can take the tour again.',
    ],
  },
  goals: {
    id: 'goals', title: 'Your goal', emoji: '🎽', icon: 'heartbeat', tone: 'yellow', where: 'Profile → Your goal',
    summary: 'Lose weight, build muscle, train harder, eat for health or energy — meals follow, gently.',
    steps: [
      'Choose a goal and enter your height, weight and how active you are. Each goal has its own way of judging a meal.',
      'Add focuses if you like: more fiber, eat the rainbow, lean protein, healthy fats, fermented foods.',
      'The app works out a day’s calories and protein (and carbs, for performance) and splits them across meals.',
      'Picks lean toward meals that fit; each recipe shows how a serving measures up, which focuses it serves, and what to add.',
    ],
    tips: ['Turn it off any time. These are estimates for planning meals, not medical advice.'],
  },
};

export const HELP_ORDER: HelpTopicId[] = [
  'home', 'decide', 'thisOrThat', 'kitchen', 'pantry', 'grocery', 'plan', 'recipe', 'cooking', 'drinks', 'saved', 'community', 'profile', 'goals',
];

// ---- the guided tour ---------------------------------------------------

export interface TourCard {
  key: string;
  kicker: string;
  title: string;
  body: string;
  emoji: string;
  tone: HelpTone;
  /** Example chips drawn on the card, so it looks like the real thing. */
  example?: string[];
  /** Deeper reading on the Help screen. */
  topic?: HelpTopicId;
}

export const TOUR: TourCard[] = [
  {
    key: 'welcome', kicker: 'Welcome', title: 'One question, answered', emoji: '🍽️', tone: 'sand',
    body: 'BiteWise exists to answer “what should I eat?” — with your allergies, your tastes and what’s in your kitchen already taken into account. Swipe to see how.',
  },
  {
    key: 'home', kicker: 'Home', title: 'A pick, and why', emoji: '🎯', tone: 'clay', topic: 'decide',
    body: 'Open the app and there’s tonight’s pick with its reasons. Swap for the next best, or tell it your mood — Quick, Comforting, Healthy, Spicy.',
    example: ['Anything', 'Quick', 'Comforting', 'Healthy', 'Spicy'],
  },
  {
    key: 'kitchen', kicker: 'Kitchen', title: 'Pantry in, groceries out', emoji: '🧺', tone: 'sage', topic: 'kitchen',
    body: 'Add what you have; every item says what’s left in plain words. Running low? One tap puts it on the list. “What can I make?” cooks from what’s there.',
    example: ['2 eggs left of 12 · running low', '1 bunch · best within 4 days'],
  },
  {
    key: 'plan', kicker: 'Plan', title: 'A week in a tap', emoji: '📅', tone: 'navy', topic: 'plan',
    body: 'Fill plans the week — varied, balanced, around the days you’re not cooking. Swap any slot. Send the week to your grocery list.',
    example: ['Mon · Lemon Herb Salmon', 'Tue · Leftovers', 'Wed · Chickpea Curry'],
  },
  {
    key: 'cook', kicker: 'Recipes', title: 'Cook it, step by step', emoji: '👩‍🍳', tone: 'clay', topic: 'cooking',
    body: 'Servings scale the amounts. Missing ingredients go to your list. Start cooking shows one step at a time, with timers and read-aloud.',
    example: ['Step 2 of 6', '⏱ 8:00', '🔊 Read this step'],
  },
  {
    key: 'more', kicker: 'And more', title: 'Saved, Community, Drinks', emoji: '💬', tone: 'yellow', topic: 'community',
    body: 'Heart recipes to keep them. Share your own and read reviews. Drinks is its own section — mocktails, smoothies, coffees and cozy cups.',
    example: ['❤️ Saved', '💬 Community', '🥤 Drinks'],
  },
  {
    key: 'you', kicker: 'You’re in charge', title: 'Change anything, any time', emoji: '👤', tone: 'sand', topic: 'profile',
    body: 'Tastes, allergies, a fitness goal, text size and voice all live in Profile. And whenever you wonder what something does, tap the little ? beside it.',
    example: ['? Help'],
  },
];
