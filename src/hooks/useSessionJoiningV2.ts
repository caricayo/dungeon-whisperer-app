import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { debugLog, debugError } from '@/lib/debug';

export interface SessionJoinResult {
  success: boolean;
  session?: {
    id: string;
    name: string;
    customPrompt: string;
    roomId: string;
    maxPlayers?: number;
    currentPlayerCount?: number;
  };
  room?: {
    id: string;
    name: string;
  };
  members?: {
    userId: string;
    role: string;
    displayName: string;
    username: string;
    avatarUrl?: string;
    joinedAt: string;
    isOnline?: boolean;
  }[];
  last30Messages?: {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: string;
    userId: string;
    displayName: string;
    avatarUrl?: string;
  }[];
  userProfile?: {
    userId: string;
    displayName: string;
    username: string;
    avatarUrl?: string;
  };
  error?: string;
  action?: string; // For specific user actions like 'setup_profile'
}

/**
 * Enhanced session joining hook with canonical room support
 */
export const useSessionJoiningV2 = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const joinMultiplayerSession = useCallback(async (sessionId: string): Promise<SessionJoinResult | null> => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to join multiplayer sessions.",
        variant: "destructive",
      });
      return null;
    }

    try {
      debugLog('🎮 Joining multiplayer session with room support:', sessionId);
      
      // Use the new RPC function that handles room creation and returns structured data
      const {data, _error} = await supabase.rpc('join_session_v2', {
        session_id: sessionId
      });

      if (error) {
        debugError('🎮 Error joining session:');
        throw new Error("Operation failed");
      }

      const result = data as unknown as SessionJoinResult;

      if (!result?.success) {
        const errorMsg = result?.error ?? 'Failed to join session';
        const action = result?.action;
        
        // Handle specific error actions
        if (action === 'setup_profile') {
          toast({
            title: "Profile Setup Required",
            description: errorMsg,
            variant: "destructive",
          });
        } else if (action === 'set_username') {
          toast({
            title: "Username Required",
            description: errorMsg,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Join Failed",
            description: errorMsg,
            variant: "destructive",
          });
        }
        return result; // Return result with action for frontend handling
      }

      debugLog('🎮 Successfully joined session with room:', result);
      
      // Clear any cached session data
      localStorage.removeItem('dnd-sessions');
      
      toast({
        title: "Session Joined!",
        description: `Welcome to "${result.session?.name}"`,
      });

      return result;

    } catch {
      debugError('🎮 Error in session join:');
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Handle specific database/network error cases
      if (errorMessage.includes('full') || errorMessage.includes('capacity')) {
        toast({
          title: "Session Full",
          description: "This adventure session has reached its maximum capacity.",
          variant: "destructive",
        });
      } else if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
        toast({
          title: "Session Not Found",
          description: "This adventure session may have ended, been deleted, or the link is invalid.",
          variant: "destructive",
        });
      } else if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
        toast({
          title: "Permission Denied",
          description: "You don't have permission to join this session.",
          variant: "destructive",
        });
      } else if (errorMessage.includes('authentication') || errorMessage.includes('sign in')) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to join multiplayer sessions.",
          variant: "destructive",
        });
      } else if (errorMessage.includes('profile') || errorMessage.includes('username')) {
        toast({
          title: "Profile Setup Required",
          description: "Please complete your profile setup before joining sessions.",
          variant: "destructive",
        });
      } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
        toast({
          title: "Connection Error",
          description: "Network issue prevented joining. Please check your connection and try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Join Error",
          description: "Could not join the session. Please try again or contact support if the issue persists.",
          variant: "destructive",
        });
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }, [user, toast]);

  return { joinMultiplayerSession };
};
