import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { debugLog, debugError } from '@/lib/debug';

export const useMultiplayerRealtime = (onSessionUpdate: () => void) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const setupRealtimeSubscriptions = useCallback(() => {
    if (!user) return null;

    const channel = supabase
      .channel('multiplayer_updates')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'sessions' }, 
        (payload) => {
          debugLog('New session created:', payload);
          if (payload.new.is_multiplayer) {
            onSessionUpdate();
          }
        }
      )
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'sessions' }, 
        (payload) => {
          debugLog('Session updated:', payload);
          if (payload.new.is_multiplayer) {
            onSessionUpdate();
          }
        }
      )
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'session_participants' }, 
        (payload) => {
          debugLog('New participant joined:', payload);
          onSessionUpdate();
          
          // Show notification if someone joins a session the user is in
          toast({
            title: "Player Joined",
            description: "A new adventurer has joined the party!",
          });
        }
      )
      .on('postgres_changes', 
        { event: 'DELETE', schema: 'public', table: 'session_participants' }, 
        (payload) => {
          debugLog('Participant left:', payload);
          onSessionUpdate();
        }
      )
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'session_invites' }, 
        (payload) => {
          debugLog('New session invite:', payload);
          if (payload.new.invitee_id === user.id) {
            toast({
              title: "Session Invite",
              description: "You've been invited to join a multiplayer adventure!",
            });
          }
        }
      )
      .subscribe((status) => {
        debugLog('Multiplayer realtime subscription status:', status);
      });

    return channel;
  }, [user, onSessionUpdate, toast]);

  useEffect(() => {
    const channel = setupRealtimeSubscriptions();
    
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [setupRealtimeSubscriptions]);
};