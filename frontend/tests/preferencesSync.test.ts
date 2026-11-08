// tests/preferencesSync.test.ts
//
// The decision an app makes after pulling the account's preferences copy:
// adopt it, upload this device's, or do nothing. This is what keeps a user
// who finished onboarding on the web from being asked again on iOS.

import { describe, expect, it } from '@jest/globals';
import { reconcilePreferences } from '../lib/preferencesSync';

const remote = (updatedAt: number, onboardedAt: number | null = updatedAt) => ({
  preferences: { name: 'Jo' },
  onboardedAt,
  updatedAt,
});

describe('reconcilePreferences', () => {
  it('does nothing when the server could not be reached', () => {
    expect(reconcilePreferences({ updatedAt: 0, onboardedAt: null, hasChanges: false }, undefined)).toBe('none');
    expect(reconcilePreferences({ updatedAt: 5, onboardedAt: 5, hasChanges: true }, undefined)).toBe('none');
  });

  it('fresh install + onboarding finished on another device → adopt the account copy', () => {
    // The bug report: set up on web (T=100), then sign in on iOS (nothing local).
    expect(reconcilePreferences({ updatedAt: 0, onboardedAt: null, hasChanges: false }, remote(100))).toBe('adopt');
  });

  it('account copy newer than this device → adopt', () => {
    expect(reconcilePreferences({ updatedAt: 50, onboardedAt: 50, hasChanges: true }, remote(100))).toBe('adopt');
  });

  it('this device newer (edited offline) → push', () => {
    expect(reconcilePreferences({ updatedAt: 200, onboardedAt: 50, hasChanges: true }, remote(100))).toBe('push');
  });

  it('same timestamp → nothing to do', () => {
    expect(reconcilePreferences({ updatedAt: 100, onboardedAt: 100, hasChanges: true }, remote(100))).toBe('none');
  });

  it('account has no copy yet: push only if this device has something worth keeping', () => {
    expect(reconcilePreferences({ updatedAt: 0, onboardedAt: null, hasChanges: false }, null)).toBe('none');
    expect(reconcilePreferences({ updatedAt: 0, onboardedAt: 0, hasChanges: false }, null)).toBe('push'); // legacy flag
    expect(reconcilePreferences({ updatedAt: 0, onboardedAt: null, hasChanges: true }, null)).toBe('push');
  });

  it('legacy install (flag, no timestamp) vs. an account row that never finished → push the flag', () => {
    expect(reconcilePreferences({ updatedAt: 0, onboardedAt: 0, hasChanges: true }, remote(0, null))).toBe('push');
  });

  it('a device that reset onboarding does not undo a finished account copy that is newer', () => {
    expect(reconcilePreferences({ updatedAt: 10, onboardedAt: null, hasChanges: false }, remote(20))).toBe('adopt');
  });
});
