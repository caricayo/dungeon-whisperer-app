import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps): React.ReactElement | null {
  const navigate = useNavigate();
  const _location = useLocation();
  
  // Add error boundary for auth context
  let user, loading, authError = false;
  try {
    const auth = useAuth();
    user = auth.user;
    loading = auth.loading;
  } catch (_err) {
    // If auth context fails, set error flag
    authError = true;
    user = null;
    loading = false;
  }

  useEffect(() => {
    if (authError) {
      navigate('/auth', { replace: true });
      return;
    }
    
    if (loading) return;
    
    // Redirect unauthenticated users to auth page
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }
  }, [user, loading, navigate, authError]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-lg">Loading...</span>
        </div>
      </div>
    );
  }

  // Don't render if no user (will redirect)
  if (!user) {
    return null;
  }

  return <>{children}</>;
}