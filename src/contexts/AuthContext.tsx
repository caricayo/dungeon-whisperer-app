import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { debugLog } from '@/lib/debug';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  resendVerification: (email: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    // Set a timeout to ensure loading doesn't hang indefinitely
    timeoutId = setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 5000);

    const initializeAuth = async () => {
      try {
        // Listen for auth changes first
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event, currentSession) => {
            if (!mounted) return;
            
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            
            // Handle profile creation in background without await
            if (currentSession?.user && event === 'SIGNED_IN') {
              setTimeout(() => {
                ensureProfileExists(currentSession.user);
              }, 0);
            }
            
            setLoading(false);
          }
        );

        // Then check for existing session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (mounted) {
          if (initialSession?.user) {
            // Handle profile creation in background without await
            setTimeout(() => {
              ensureProfileExists(initialSession.user);
            }, 0);
          }
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          setLoading(false);
          clearTimeout(timeoutId);
        }

        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setLoading(false);
          clearTimeout(timeoutId);
        }
      }
    };

    const cleanup = initializeAuth();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      cleanup?.then(cleanupFn => cleanupFn?.());
    };
  }, []); // Remove loading dependency to prevent infinite loop

  // Check if profile exists and create only if missing (never overwrite existing profiles)
  const ensureProfileExists = async (user: User) => {
    try {
      // First check if profile already exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('id', user.id)
        .maybeSingle();

      if (checkError) {
        debugLog('Profile check error (non-critical):', checkError);
        return;
      }

      // If profile exists, don't modify it
      if (existingProfile) {
        debugLog('Profile already exists for user:', user.id, 'username:', existingProfile.username);
        return;
      }

      // Only create profile if it doesn't exist - with minimal auto-generated data
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          username: `user_${user.id.substring(0, 8)}`, // Temporary username that will trigger username setup
          display_name: user.user_metadata?.display_name || 
                       user.user_metadata?.full_name ||
                       user.user_metadata?.name ||
                       null,
          avatar_url: user.user_metadata?.avatar_url,
          username_reset_required: true // Mark as requiring username setup
        });
      
      if (error) {
        debugLog('Profile creation error (non-critical):', error);
      } else {
        debugLog('New profile created for user:', user.id);
      }
    } catch (error) {
      debugLog('Profile check/creation failed (non-critical):', error);
    }
  };

  const signIn = async (email: string, password: string): Promise<{ error: AuthError | null }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const signInWithGoogle = async (): Promise<{ error: AuthError | null }> => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const signUp = async (email: string, password: string): Promise<{ error: AuthError | null }> => {
    try {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth?verified=true`,
        },
      });
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const signOut = async (): Promise<{ error: AuthError | null }> => {
    try {
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const resetPassword = async (email: string): Promise<{ error: AuthError | null }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const resendVerification = async (email: string): Promise<{ error: AuthError | null }> => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth?verified=true`,
        }
      });
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    resetPassword,
    resendVerification,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};