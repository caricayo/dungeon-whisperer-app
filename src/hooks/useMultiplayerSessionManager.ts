import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useSessionJoiningV2 } from '@/hooks/useSessionJoiningV2';
import { debugLog, debugError } from '@/lib/debug';
import { Session } from '@/hooks/useSessionManager';

export const useMultiplayerSessionManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { joinMultiplayerSession } = useSessionJoiningV2();

  // Join and set up a multiplayer session
  const joinAndSetupMultiplayerSession = useCallback(async (
    sessionId: string,
    setCurrentSession: (session: Session | null) => void,
    navigate?: (path: string) => void
  ) => {
    try {
      debugLog('🎮 Joining multiplayer session:', sessionId);
      
      // Pre-check: Validate user profile before attempting to join
      if (user) {
        const { data: profileCheck, error: profileError } = await supabase.rpc('validate_user_profile_for_session', {
          user_id: user.id
        });

        if (profileError) {
          debugError('🎮 Profile validation error:', profileError);
          toast({
            title: "Profile Check Failed",
            description: "Unable to validate your profile. Please try again.",
            variant: "destructive",
          });
          return null;
        }

        if (!profileCheck?.valid) {
          debugLog('🎮 Profile validation failed:', profileCheck);
          
          if (profileCheck?.action === 'create_profile') {
            // Attempt to create profile automatically
            const { data: profileSetup, error: setupError } = await supabase.rpc('setup_user_profile', {
              user_id: user.id
            });
            
            if (setupError || !profileSetup?.success) {
              toast({
                title: "Profile Setup Required",
                description: "Please complete your profile setup before joining sessions.",
                variant: "destructive",
              });
              return null;
            } else {
              toast({
                title: "Profile Created",
                description: `Welcome ${profileSetup.username}! You can now join sessions.`,
              });
            }
          } else {
            toast({
              title: "Profile Incomplete",
              description: profileCheck?.error || "Please complete your profile setup.",
              variant: "destructive",
            });
            return null;
          }
        }
      }
      
      const joinResult = await joinMultiplayerSession(sessionId);
      
      if (joinResult?.success && joinResult.session) {
        // Convert the session data to our local Session format using the enhanced result
        const multiplayerSession: Session = {
          id: joinResult.session.id,
          name: joinResult.session.name,
          messages: (joinResult.last30Messages || []).map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          })),
          customPrompt: joinResult.session.customPrompt || '',
          createdAt: new Date(),
          isMultiplayer: true,
          isSynced: true
        };

        debugLog('🎮 Setting up multiplayer session locally:', multiplayerSession);
        debugLog('🎮 Room info:', joinResult.room);
        debugLog('🎮 Members:', joinResult.members);
        
        setCurrentSession(multiplayerSession);
        
        // Clear local session cache to prevent conflicts
        localStorage.removeItem('dnd-sessions');
        localStorage.setItem('lastSessionId', multiplayerSession.id);
        localStorage.setItem('multiplayerRoomId', joinResult.session.roomId || '');
        
        // Navigate to chat if navigation function provided
        if (navigate) {
          navigate('/maindashboard');
        }
        
        return multiplayerSession;
      }
      
      return null;
    } catch (error) {
      debugError('🎮 Error joining multiplayer session:', error);
      
      // Handle specific error cases
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      toast({
        title: "Session Join Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      return null;
    }
  }, [joinMultiplayerSession, user, toast]);

  return {
    joinAndSetupMultiplayerSession
  };
};