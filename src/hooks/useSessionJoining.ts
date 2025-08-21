import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { debugLog, debugError } from '@/lib/debug';

export const useSessionJoining = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const joinMultiplayerSession = useCallback(async (sessionId: string) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to join multiplayer sessions.",
        variant: "destructive",
      });
      return null;
    }

    try {
      debugLog('Attempting to join multiplayer session:', sessionId);

      const {data, _error} = await supabase.rpc('join_multiplayer_session', {
        session_id: sessionId
      });

      if (error) {
        // Handle unique constraint violation gracefully
        if (error.message?.includes('duplicate') || error.message?.includes('unique_session_participant')) {
          debugLog('User already joined this session, fetching session data');
          
          // Fetch the session data directly since user is already a participant
          const { data: sessionData, error: fetchError } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', sessionId)
            .single();

          if (fetchError) throw fetchError;

          toast({
            title: "Already Joined!",
            description: "You're already part of this multiplayer session.",
          });

          return sessionData;
        }
        throw new Error("Operation failed");
      }

      interface SessionResult {
        success: boolean;
        message?: string;
        error?: string;
        session?: {
          id: string;
          name: string;
          messages: unknown[];
          customPrompt: string;
          createdAt: string;
          updatedAt?: string;
          isMultiplayer?: boolean;
        };
      }
      const result = data as SessionResult;

      if (result?.success) {
        toast({
          title: "Joined Session!",
          description: result.message ?? "Successfully joined the multiplayer session!",
        });

        debugLog('Successfully joined multiplayer session, returning session data');
        return result.session; // Return session data for immediate use
      } else {
        toast({
          title: "Join Failed",
          description: result?.error ?? "Could not join the multiplayer session.",
          variant: "destructive",
        });
        return null;
      }

    } catch {
      debugError('Error joining multiplayer session:');
      toast({
        title: "Join Failed",
        description: "Could not join the multiplayer session. Please try again.",
        variant: "destructive",
      });
      return null;
    }
  }, [user, toast]);

  return { 
    joinMultiplayerSession: (sessionId: string) => Promise<SessionResult['session'] | null>
  };
};
