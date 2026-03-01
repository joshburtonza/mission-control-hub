import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface MCUser {
  email: string;
  role: 'owner' | 'staff';
  display_name: string | null;
  allowed_pages: string[];
}

interface AuthState {
  session: Session | null;
  mcUser: MCUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isOwner: boolean;
  canAccess: (path: string) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

async function fetchMCUser(email: string): Promise<MCUser | null> {
  try {
    const { data, error } = await (supabase as any)
      .from('mc_users')
      .select('*')
      .eq('email', email)
      .single();
    if (error) {
      console.warn('[fetchMCUser] error for', email, error.code, error.message);
      return null;
    }
    return data as MCUser | null;
  } catch (e) {
    console.warn('[fetchMCUser] exception for', email, e);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession]   = useState<Session | null>(null);
  const [mcUser, setMCUser]     = useState<MCUser | null>(null);
  const [loading, setLoading]   = useState(true);
  const loadingDone = useRef(false);

  // Single helper — idempotent, first call wins
  const markLoaded = () => {
    if (!loadingDone.current) {
      loadingDone.current = true;
      setLoading(false);
    }
  };

  useEffect(() => {
    // Hard timeout — loading MUST clear within 6s no matter what
    const fallback = setTimeout(markLoaded, 6000);

    // onAuthStateChange fires first in Supabase v2 (INITIAL_SESSION event)
    // This is the primary path for clearing loading
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        if (newSession?.user?.email) {
          const user = await fetchMCUser(newSession.user.email);
          setMCUser(user);
        } else {
          setMCUser(null);
        }
        markLoaded();
      }
    );

    // getSession() as a secondary path (handles cases where onAuthStateChange
    // doesn't fire, e.g. server-side rendering edge cases)
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!loadingDone.current) {
        setSession(s);
        if (s?.user?.email) {
          const user = await fetchMCUser(s.user.email);
          setMCUser(user);
        }
        markLoaded();
      }
    }).catch(markLoaded);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallback);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setMCUser(null);
  };

  const isOwner = mcUser?.role === 'owner';

  const canAccess = (path: string): boolean => {
    if (!mcUser) return false;
    if (mcUser.allowed_pages.includes('*')) return true;
    return mcUser.allowed_pages.some(p => path === p || path.startsWith(p + '/'));
  };

  return (
    <AuthContext.Provider value={{ session, mcUser, loading, signIn, signOut, isOwner, canAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
