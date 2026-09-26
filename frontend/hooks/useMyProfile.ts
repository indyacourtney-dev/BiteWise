// hooks/useMyProfile.ts
//
// The signed-in user's profile (display name + photo), shared by the Home
// header and the settings screens. Loaded once per sign-in and updated in
// place after changes, so a new photo shows everywhere immediately.

import { useCallback, useEffect, useState } from 'react';
import { configured } from '../lib/supabase';
import { fetchMyProfile, type MyProfile } from '../lib/accountApi';
import { useAuth } from '../context/AuthContext';

let cache: { userId: string; profile: MyProfile } | null = null;
const listeners = new Set<(p: MyProfile | null) => void>();

export function setMyProfileCache(profile: MyProfile | null) {
  cache = profile ? { userId: profile.id, profile } : null;
  listeners.forEach(l => l(profile));
}

export function useMyProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<MyProfile | null>(
    cache && user && cache.userId === user.id ? cache.profile : null
  );
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user || !configured) return;
    try {
      setMyProfileCache(await fetchMyProfile());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your profile');
    }
  }, [user]);

  useEffect(() => {
    listeners.add(setProfile);
    if (user && (!cache || cache.userId !== user.id)) refresh();
    return () => {
      listeners.delete(setProfile);
    };
  }, [user, refresh]);

  return { profile, error, refresh };
}
