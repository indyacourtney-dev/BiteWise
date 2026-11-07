// tests/voices.test.ts — the voice picker's list logic (Settings → Accessibility).

import { describe, expect, it } from '@jest/globals';
import { displayName, languageLabel, sortVoices, voicesForLanguage, type VoiceOption } from '../utils/voices';

const v = (id: string, language: string, enhanced = false, name = id): VoiceOption => ({
  id, name, language, languageLabel: languageLabel(language), enhanced,
});

describe('displayName', () => {
  it('cleans Apple identifiers', () => {
    expect(displayName(undefined, 'com.apple.voice.compact.en-US.Samantha')).toBe('Samantha');
    expect(displayName('com.apple.ttsbundle.Daniel-compact', 'x')).toBe('Daniel');
    expect(displayName('com.apple.voice.premium.en-GB.Serena', 'x')).toBe('Serena');
  });
  it('cleans Android and web names', () => {
    expect(displayName('en-us-x-sfg#female_2-local', 'x')).toBe('Female 2');
    expect(displayName('Microsoft Zira - English (United States)', 'x')).toBe('Zira');
    expect(displayName('Google US English', 'x')).toBe('Google US English');
  });
  it('falls back to the id', () => {
    expect(displayName('  ', 'abc')).toBe('abc');
  });
});

describe('languageLabel', () => {
  it('names common tags', () => {
    expect(languageLabel('en-US')).toBe('English (US)');
    expect(languageLabel('en_GB')).toBe('English (UK)');
    expect(languageLabel('fr')).toBe('French');
    expect(languageLabel('xx-YY')).toBe('xx-YY (YY)');
  });
});

describe('sortVoices / voicesForLanguage', () => {
  const voices = [
    v('fr1', 'fr-FR'),
    v('en-au', 'en-AU'),
    v('en-us-plain', 'en-US', false, 'Bob'),
    v('en-us-enh', 'en-US', true, 'Zoe'),
    v('de1', 'de-DE'),
  ];

  it("puts the user's exact locale first, enhanced on top, then other same-language, then the rest by language name", () => {
    // ...French before German: the rest is grouped alphabetically by language label.
    expect(sortVoices(voices, 'en-US').map(x => x.id)).toEqual(['en-us-enh', 'en-us-plain', 'en-au', 'fr1', 'de1']);
  });

  it("keeps only the user's language when it has any voices", () => {
    expect(voicesForLanguage(voices, 'en-GB').map(x => x.id).sort()).toEqual(['en-au', 'en-us-enh', 'en-us-plain']);
  });

  it('shows everything when the language has no voices', () => {
    expect(voicesForLanguage(voices, 'ja-JP')).toHaveLength(5);
  });
});
