// utils/voices.ts
//
// The voices a device can read recipes with (Settings → Accessibility →
// Read aloud → Voice). expo-speech lists them; this file makes the list
// usable: loads it once, puts the user's own language first, sorts the
// better ("enhanced") voices to the top, and turns identifiers like
// "com.apple.voice.compact.en-US.Samantha" into "Samantha".

import * as Speech from 'expo-speech';

export interface VoiceOption {
  id: string;
  name: string;
  /** BCP-47 tag, e.g. "en-US". */
  language: string;
  /** Spoken-language label, e.g. "English (US)". */
  languageLabel: string;
  enhanced: boolean;
}

let cache: VoiceOption[] | null = null;
let known: Set<string> | null = null;

const REGION_NAMES: Record<string, string> = {
  US: 'US', GB: 'UK', AU: 'Australia', CA: 'Canada', IE: 'Ireland', IN: 'India', ZA: 'South Africa',
  NZ: 'New Zealand', ES: 'Spain', MX: 'Mexico', AR: 'Argentina', FR: 'France', BR: 'Brazil', PT: 'Portugal',
  DE: 'Germany', AT: 'Austria', CH: 'Switzerland', IT: 'Italy', CN: 'China', TW: 'Taiwan', HK: 'Hong Kong',
  JP: 'Japan', KR: 'Korea', NL: 'Netherlands', BE: 'Belgium', SE: 'Sweden', NO: 'Norway', DK: 'Denmark',
  FI: 'Finland', PL: 'Poland', RU: 'Russia', TR: 'Turkey', SA: 'Saudi Arabia', IL: 'Israel', GR: 'Greece',
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', zh: 'Chinese',
  ja: 'Japanese', ko: 'Korean', nl: 'Dutch', sv: 'Swedish', nb: 'Norwegian', no: 'Norwegian', da: 'Danish',
  fi: 'Finnish', pl: 'Polish', ru: 'Russian', tr: 'Turkish', ar: 'Arabic', he: 'Hebrew', el: 'Greek',
  hi: 'Hindi', th: 'Thai', vi: 'Vietnamese', id: 'Indonesian', cs: 'Czech', hu: 'Hungarian', ro: 'Romanian',
  uk: 'Ukrainian', ca: 'Catalan', sk: 'Slovak', hr: 'Croatian', ms: 'Malay', bg: 'Bulgarian',
};

/** "en-US" → "English (US)"; "fr" → "French". Unknown codes are shown as-is. */
export function languageLabel(tag: string): string {
  const [lang, region] = tag.replace('_', '-').split('-');
  const base = LANGUAGE_NAMES[lang?.toLowerCase()] ?? tag;
  if (!region) return base;
  return `${base} (${REGION_NAMES[region.toUpperCase()] ?? region.toUpperCase()})`;
}

/** Make a voice's name readable; platforms differ a lot here. */
export function displayName(raw: string | undefined, id: string): string {
  let name = (raw && raw.trim()) || id;
  // Apple: "com.apple.voice.compact.en-US.Samantha" / "com.apple.ttsbundle.Samantha-compact"
  if (/^com\.apple\./i.test(name)) {
    const last = name.split('.').pop() ?? name;
    name = last.replace(/-(compact|premium|enhanced)$/i, '');
  }
  // Android: "en-us-x-sfg#female_2-local" → "Female 2"
  const android = name.match(/#(\w+?)[-_](\d+)/);
  if (android) name = `${android[1][0].toUpperCase()}${android[1].slice(1)} ${android[2]}`;
  // Web: "Google US English", "Microsoft Zira - English (United States)"
  name = name.replace(/\s*-\s*[A-Za-z]+ \([^)]*\)$/, '').replace(/^Microsoft\s+/i, '');
  return name.trim() || id;
}

function isEnhanced(v: Speech.Voice): boolean {
  if (v.quality === Speech.VoiceQuality.Enhanced) return true;
  return /premium|enhanced|neural|natural/i.test(`${v.identifier} ${v.name}`);
}

/** All voices on this device, loaded once. [] when speech isn't available. */
export async function loadVoices(): Promise<VoiceOption[]> {
  if (cache) return cache;
  try {
    const raw = await Speech.getAvailableVoicesAsync();
    const seen = new Set<string>();
    cache = raw
      .filter(v => v.identifier && !seen.has(v.identifier) && seen.add(v.identifier))
      .map(v => ({
        id: v.identifier,
        name: displayName(v.name, v.identifier),
        language: (v.language || '').replace('_', '-'),
        languageLabel: languageLabel(v.language || ''),
        enhanced: isEnhanced(v),
      }));
    known = new Set(cache.map(v => v.id));
  } catch {
    cache = [];
    known = new Set();
  }
  return cache;
}

/** For tests. */
export function resetVoiceCache() {
  cache = null;
  known = null;
}

/**
 * A saved voice id is only used if this device actually has it (voices are
 * per device; a stale id would make some platforms fall silent). Before the
 * list has loaded the id is trusted.
 */
export function usableVoiceId(id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  if (known && !known.has(id)) return undefined;
  return id;
}

/**
 * Order for the picker: the user's language first (its enhanced voices at
 * the top, then by name), then everything else grouped by language.
 */
export function sortVoices(voices: VoiceOption[], preferredLanguage: string): VoiceOption[] {
  const pref = preferredLanguage.toLowerCase().split('-')[0];
  const prefTag = preferredLanguage.toLowerCase();
  const rank = (v: VoiceOption) => {
    const l = v.language.toLowerCase();
    if (l === prefTag) return 0;
    if (l.split('-')[0] === pref) return 1;
    return 2;
  };
  return [...voices].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      a.languageLabel.localeCompare(b.languageLabel) ||
      Number(b.enhanced) - Number(a.enhanced) ||
      a.name.localeCompare(b.name),
  );
}

/** Voices in the user's language, or all of them if there are none. */
export function voicesForLanguage(voices: VoiceOption[], preferredLanguage: string): VoiceOption[] {
  const pref = preferredLanguage.toLowerCase().split('-')[0];
  const mine = voices.filter(v => v.language.toLowerCase().split('-')[0] === pref);
  return mine.length > 0 ? mine : voices;
}
