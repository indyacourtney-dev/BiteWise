// context/AuthContext.tsx
//
// Matches the API that app/auth.tsx consumes:
//   signIn({ email, password })            — throws Error(message) on failure
//   signUp({ email, username, password })  — throws; username saved to user metadata
//   resendVerification(email)              — throws; re-sends the signup email
//   configured                             — false when .env keys are missing
//   user, initializing                     — consumed by AuthAndOnboardingGate
//
// Email confirmation should be ON in the Supabase dashboard — the auth
// screen's "verify" mode depends on it.

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, configured } from '@/lib/supabase';

type SignInArgs = { email: string; password: string };
type SignUpArgs = { email: string; username: string; password: string };

type AuthContextType = {
  user: User | null;
  session: Session | null;
  initializing: boolean;
  configured: boolean;
  signIn: (args: SignInArgs) => Promise<void>;
  signUp: (args: SignUpArgs) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function assertConfigured() {
  if (!configured) {
    throw new Error(
      'Auth backend isn’t configured. Add EXPO_PUBLIC_SUPABASE_URL and ' +
        'EXPO_PUBLIC_SUPABASE_ANON_KEY to .env, then restart with `npx expo start -c`.'
    );
  }
}

// Supabase's raw messages can be terse; translate the common ones.
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return 'Wrong email or password — or the email hasn’t been verified yet.';
  }
  if (m.includes('email not confirmed')) {
    return 'That email hasn’t been verified yet. Check your inbox for the link.';
  }
  if (m.includes('already registered')) {
    return 'An account with that email already exists. Try logging in.';
  }
  if (m.includes('rate limit')) {
    return 'Too many attempts — wait a minute and try again.';
  }
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (!configured) {
      setInitializing(false);
      return;
    }

    // With persistSession: false this resolves null on launch, which is
    // what sends every user to /auth first — by design.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async ({ email, password }: SignInArgs) => {
    assertConfigured();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(friendly(error.message));
    // Success: onAuthStateChange sets the session; the gate routes onward.
  };

  const signUp = async ({ email, username, password }: SignUpArgs) => {
    assertConfigured();
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        // Stored in auth user metadata; read later via user.user_metadata.username
        data: { username: username.trim() },
      },
    });
    if (error) throw new Error(friendly(error.message));
    // Screen switches itself to "verify" mode after this resolves.
  };

  const resendVerification = async (email: string) => {
    assertConfigured();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
    });
    if (error) throw new Error(friendly(error.message));
  };

  const signOut = async () => {
    if (!configured) return;
    await supabase.auth.signOut();
    // Session becomes null → gate rule 1 bounces to /auth.
  };

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        initializing,
        configured,
        signIn,
        signUp,
        resendVerification,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
