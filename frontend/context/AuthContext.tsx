// context/AuthContext.tsx
//
// Owns the auth session. Everything else in the app asks this context
// two questions: "who is logged in?" (user) and "are you still figuring
// that out?" (initializing). The gate in app/_layout.tsx routes on the
// answers, and AppContext namespaces its storage by user.id so two
// accounts on one phone never see each other's pantry or preferences.
//
// Because lib/supabase.ts sets persistSession: false, there is never a
// saved session to restore — every cold start begins logged out, which
// is the "log in every time you open the app" requirement.

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';

import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ============================================
// TYPES
// ============================================

export interface AuthUser {
  id: string;
  email: string;
  username: string;
}

interface AuthContextValue {
  /** True while the initial session check runs (fast, but async). */
  initializing: boolean;
  /** The logged-in user, or null. */
  user: AuthUser | null;
  configured: boolean;

  signUp: (args: { email: string; username: string; password: string }) => Promise<void>;
  signIn: (args: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ============================================
// ERROR TRANSLATION
// ============================================
// Supabase's raw messages range from fine to cryptic. Map the common
// ones to sentences a college student rushing between classes can act
// on; pass anything unknown through untouched.

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials'))
    return 'Wrong email or password. Check both and try again.';
  if (m.includes('email not confirmed'))
    return 'Your email isn\u2019t verified yet. Tap the link in the email we sent you, then log in.';
  if (m.includes('user already registered'))
    return 'An account with that email already exists. Try logging in instead.';
  if (m.includes('rate limit') || m.includes('too many requests'))
    return 'Too many attempts \u2014 wait a minute and try again.';
  if (m.includes('database error saving new user'))
    return 'That username is taken. Pick another one.';
  if (m.includes('network request failed'))
    return 'No connection. Check your internet and try again.';
  return message;
}

// ============================================
// PROVIDER
// ============================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    // With persistSession off this resolves to "no session" on launch,
    // but doing the check properly means nothing breaks if the team
    // ever flips persistence on.
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setUser(
        u
          ? {
              id: u.id,
              email: u.email ?? '',
              username: (u.user_metadata?.username as string) ?? 'friend',
            }
          : null
      );
      setInitializing(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      setUser(
        u
          ? {
              id: u.id,
              email: u.email ?? '',
              username: (u.user_metadata?.username as string) ?? 'friend',
            }
          : null
      );
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signUp = useCallback(
    async ({ email, username, password }: { email: string; username: string; password: string }) => {
      // Best-effort username availability check against the profiles
      // table (see SETUP-AUTH.md). If the table isn't set up yet this
      // query errors and we skip the pre-check — the DB's unique index
      // still catches duplicates at creation time.
      try {
        const { data } = await supabase
          .from('profiles')
          .select('username')
          .ilike('username', username.trim())
          .maybeSingle();
        if (data) throw new Error('That username is taken. Pick another one.');
      } catch (e: any) {
        if (e?.message?.includes('username is taken')) throw e;
        // table missing / RLS blocked → fall through to signup
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { username: username.trim() } },
      });
      if (error) throw new Error(friendly(error.message));

      // Supabase quirk: signing up with an email that already exists
      // returns success with an empty identities array instead of an
      // error, to avoid leaking which emails are registered. Surface it.
      if (data.user && data.user.identities?.length === 0) {
        throw new Error('An account with that email already exists. Try logging in instead.');
      }
      // Success: verification email is on its way. No session yet —
      // Supabase requires the email to be confirmed before login.
    },
    []
  );

  const signIn = useCallback(async ({ email, password }: { email: string; password: string }) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(friendly(error.message));
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
    });
    if (error) throw new Error(friendly(error.message));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        initializing,
        user,
        configured: isSupabaseConfigured,
        signUp,
        signIn,
        signOut,
        resendVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return ctx;
}
