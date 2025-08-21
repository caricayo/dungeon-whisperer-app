import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { debugLog, debugError } from '@/lib/debug';

interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
  table: string;
}

interface RealtimeConfig {
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  callback: (payload: RealtimePayload) => void;
}

export const useReliableRealtime = (configs: RealtimeConfig[], channelName?: string) => {
  const { user } = useAuth();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      debugLog('🔄 Cleaning up realtime channel');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
  }, []);

  const setupChannel = useCallback(() => {
    if (!user || configs.length === 0) {
      setConnectionStatus('disconnected');
      return;
    }

    cleanup();
    setConnectionStatus('connecting');
    
    const channel = supabase.channel(channelName ?? `realtime-${Date.now()}`);
    
    // Add all configurations to the channel
    configs.forEach(({ table, event, filter, callback }) => {
      channel.on(
        'postgres_changes' as const,
        {
          event,
          schema: 'public',
          table,
          ...(filter && { filter })
        },
        (payload) => {
          debugLog(`🔄 Realtime update on ${table}:`, payload);
          try {
            callback(payload);
          } catch (error) {
            debugError(`🔄 Callback error for ${table}:`, error);
          }
        }
      );
    });

    channel
      .subscribe((status) => {
        debugLog(`🔄 Realtime status: ${status}`);
        
        switch (status) {
          case 'SUBSCRIBED':
            setConnectionStatus('connected');
            setReconnectAttempts(0);
            break;
          case 'CHANNEL_ERROR':
          case 'TIMED_OUT':
          case 'CLOSED':
            setConnectionStatus('disconnected');
            scheduleReconnect();
            break;
        }
      });

    channelRef.current = channel;
  }, [user, configs, channelName, cleanup]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttempts >= 5) {
      debugError('🔄 Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    debugLog(`🔄 Scheduling reconnect in ${delay}ms (attempt ${reconnectAttempts + 1})`);
    
    setReconnectAttempts(prev => prev + 1);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      setupChannel();
    }, delay);
  }, [reconnectAttempts, setupChannel]);

  // Initial setup and reconnection on config changes
  useEffect(() => {
    setupChannel();
    return cleanup;
  }, [setupChannel]);

  // Handle page visibility for connection management
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page hidden - maintain connection but don't aggressively reconnect
        debugLog('🔄 Page hidden, maintaining realtime connection');
      } else {
        // Page visible - ensure connection is active
        debugLog('🔄 Page visible, checking realtime connection');
        if (connectionStatus === 'disconnected') {
          setupChannel();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [connectionStatus, setupChannel]);

  // Force reconnection method
  const forceReconnect = useCallback(() => {
    setReconnectAttempts(0);
    setupChannel();
  }, [setupChannel]);

  return {
    connectionStatus,
    reconnectAttempts,
    isConnected: connectionStatus === 'connected',
    isReconnecting: connectionStatus === 'connecting' && reconnectAttempts > 0,
    forceReconnect
  };
};
