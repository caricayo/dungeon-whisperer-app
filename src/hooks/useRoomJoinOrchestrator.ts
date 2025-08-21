import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useMultiplayerSessionManager } from '@/hooks/useMultiplayerSessionManager';
import { useMultiplayerRealtimeSync } from '@/hooks/useMultiplayerRealtimeSync';
import { usePresenceManager } from '@/hooks/usePresenceManager';
import { debugLog, debugError } from '@/lib/debug';
import { Session, type Message } from '@/hooks/useSessionManager';
import type { SessionParticipant } from '@/hooks/useMultiplayerSessions';

export interface RoomJoinResult {
  success: boolean;
  session?: Session;
  error?: string;
  participants?: SessionParticipant[];
}

export const useRoomJoinOrchestrator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { joinAndSetupMultiplayerSession } = useMultiplayerSessionManager();
  const { updateUserPresence, setUserStatus } = usePresenceManager('session_presence');

  // Join room and subscribe to realtime updates
  const joinRoomAndSubscribe = useCallback(async (
    sessionId: string,
    setCurrentSession: (session: Session | null) => void
  ): Promise<RoomJoinResult> => {
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    debugLog('🚪 Starting room join orchestration for:', sessionId);

    try {
      // Step 1: Resolve session ID (already canonical UUID in our case)
      const canonicalSessionId = sessionId;
      debugLog('🚪 Using canonical session ID:', canonicalSessionId);

      // Step 2: Join endpoint - idempotent session join
      debugLog('🚪 Attempting to join session...');
      const multiplayerSession = await joinAndSetupMultiplayerSession(
        canonicalSessionId,
        setCurrentSession,
        navigate
      );

      if (!multiplayerSession) {
        return { success: false, error: 'Failed to join session' };
      }

      debugLog('🚪 Successfully joined session:', multiplayerSession.name);

      // Step 3: Subscribe to realtime channel room:{id}
      const channelName = `session:${canonicalSessionId}`;
      debugLog('🚪 Setting up realtime sync for channel:', channelName);

      // Step 4: Emit presence and start heartbeat
      await updateUserPresence(true, 'online');
      await setUserStatus('online');
      debugLog('🚪 Updated presence status');

      // Step 5: Get initial participants
      const { data: participants, error: participantsError } = await supabase
        .from('session_participants')
        .select(`
          user_id,
          role,
          joined_at,
          profiles:user_id (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('session_id', canonicalSessionId);

      if (participantsError) {
        debugError('🚪 Error fetching participants:', participantsError);
      }

      toast({
        title: "Room Joined",
        description: `Successfully joined "${multiplayerSession.name}"`,
      });

      return {
        success: true,
        session: multiplayerSession,
        participants: participants || []
      };

    } catch {
      debugError('🚪 Room join orchestration failed:');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      toast({
        title: "Failed to Join Room",
        description: errorMessage,
        variant: "destructive",
      });

      return { success: false, error: errorMessage };
    }
  }, [user, toast, navigate, joinAndSetupMultiplayerSession, updateUserPresence, setUserStatus]);

  // Delta sync messages since last cursor
  const deltaSyncMessages = useCallback(async (
    sessionId: string,
    lastCursor?: string
  ): Promise<Message[]> => {
    if (!user) return [];

    try {
      debugLog('🔄 Delta syncing messages for session:', sessionId, 'since:', lastCursor);
      
      // Get messages since the last known cursor
      const query = supabase
        .from('sessions')
        .select('messages')
        .eq('id', sessionId)
        .single();

      const {data, _error} = await query;
      
      if (error) throw new Error("Operation failed");
      
      const messages = (data.messages as Message[]) || [];
      
      // If we have a cursor, filter to messages after that timestamp
      if (lastCursor) {
        const cursorDate = new Date(lastCursor);
        return messages.filter(msg => new Date(msg.timestamp) > cursorDate);
      }
      
      // Return latest 30 messages for cold start
      return messages.slice(-30);
      
    } catch {
      debugError('🔄 Delta sync failed:');
      return [];
    }
  }, [user]);

  // Leave room and cleanup
  const leaveRoom = useCallback(async (sessionId: string) => {
    if (!user) return;

    try {
      debugLog('🚪 Leaving room:', sessionId);
      
      // Update presence to offline
      await setUserStatus('offline');
      
      // Leave the session (remove from participants)
      const { error } = await supabase
        .from('session_participants')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', user.id);

      if (error) {
        debugError('🚪 Error leaving session:');
      } else {
        debugLog('🚪 Successfully left session');
        toast({
          title: "Left Room",
          description: "You have left the session",
        });
      }
    } catch {
      debugError('🚪 Leave room failed:');
    }
  }, [user, setUserStatus, toast]);

  return {
    joinRoomAndSubscribe,
    deltaSyncMessages,
    leaveRoom
  };
};
