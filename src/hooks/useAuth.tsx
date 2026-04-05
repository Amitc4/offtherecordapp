/**
 * @file useAuth.tsx — Authentication context & hook.
 *
 * Provides the `AuthProvider` (wraps the app) and the `useAuth()` hook that
 * any component can call to access:
 *
 * - `user`    – The currently signed-in Supabase `User` object, or `null`.
 * - `session` – The active Supabase `Session` (contains access token, etc.).
 * - `loading` – `true` while the initial session is being resolved.
 * - `signUp(email, password, displayName?)` – Creates a new account.
 * - `signIn(email, password)` – Signs in with email + password.
 * - `signOut()` – Logs the user out.
 *
 * **How it works:**
 * 1. On mount, calls `supabase.auth.getSession()` to restore any existing session.
 * 2. Subscribes to `onAuthStateChange` so that sign-in / sign-out events
 *    (including token refreshes) automatically update the React state.
 * 3. The subscription is cleaned up when the provider unmounts.
 */
import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

/** Shape of the values exposed by the Auth context. */
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Wrap your app with `<AuthProvider>` so that every descendant can call `useAuth()`.
 */
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Restore session from storage / cookie on first load.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2. Listen for future auth events (sign-in, sign-out, token refresh).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  /** Register a new user. Optionally stores `displayName` in user metadata. */
  const signUp = async (email: string, password: string, displayName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    return { error };
  };

  /** Sign in with email + password. */
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  /** Sign the current user out (clears session). */
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to access the current auth state.
 * Must be used inside `<AuthProvider>`.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
