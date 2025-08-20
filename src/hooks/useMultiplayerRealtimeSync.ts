import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { debugLog, debugError } from '@/lib/debug';

interface MultiplayerRealtimeSyncProps {
  sessionId: string | null;
  onSessionUpdate: (sessionData: any) => void;
}

export const useMultiplayerRealtimeSync = ({ sessionId, onSessionUpdate }: MultiplayerRealtimeSyncProps) => {
  useEffect(() => {
    if (!sessionId) return;

    debugLog('🔄 Setting up multiplayer realtime sync for session:', sessionId);

    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          debugLog('🔄 Received session update:', payload);
          if (payload.new) {
            onSessionUpdate(payload.new);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          debugLog('✅ SUBSCRIBED to multiplayer session updates for session:', sessionId);
          console.log('✅ Realtime sync channel SUBSCRIBED successfully for session:', sessionId);
        } else if (status === 'CHANNEL_ERROR') {
          debugError('❌ CHANNEL_ERROR subscribing to multiplayer session updates for session:', sessionId);
          console.error('❌ Realtime sync channel error for session:', sessionId);
        } else {
          debugLog('🔄 Realtime sync status:', status, 'for session:', sessionId);
        }
      });

    return () => {
      debugLog('🔄 Cleaning up multiplayer realtime sync');
      supabase.removeChannel(channel);
    };
  }, [sessionId, onSessionUpdate]);
};