import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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
  const { data } = await (supabase as any)
    .from('mc_users')
    .select('*')
    .eq('email', email)
    .single();
  return data as MCUser | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession]   = useState<Session | null>(null);
  const [mcUser, setMCUser]     = useState<MCUser | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    // Restore existing session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user?.email) {
        const user = await fetchMCUser(session.user.email);
        setMCUser(user);
      }
      setLoading(false);
    }).catch(() => setLoading(false));

    // Listen for auth changes (magic link callback, sign-out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user?.email) {
        const user = await fetchMCUser(session.user.email);
        setMCUser(user);
      } else {
        setMCUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
