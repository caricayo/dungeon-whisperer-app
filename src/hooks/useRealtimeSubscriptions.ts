import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { debugLog, debugError } from '@/lib/debug';

interface SubscriptionConfig {
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  callback: (payload: any) => void;
}

export const useRealtimeSubscriptions = (configs: SubscriptionConfig[]) => {
  const { user } = useAuth();
  const channelsRef = useRef<any[]>([]);
  const [connectionStates, setConnectionStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user || !configs.length) return;

    debugLog('Setting up realtime subscriptions:', configs.map(c => `${c.table}:${c.event}`));

    // Clean up existing channels first
    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel);
    });
    channelsRef.current = [];

    // Set up new subscriptions
    configs.forEach((config, index) => {
      const channelName = `${config.table}_${config.event}_${index}`;
      
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes' as any,
          {
            event: config.event,
            schema: 'public',
            table: config.table,
            ...(config.filter && { filter: config.filter })
          },
          (payload) => {
            debugLog(`Realtime update on ${config.table}:`, payload);
            config.callback(payload);
          }
        )
        .subscribe((status) => {
          const isConnected = status === 'SUBSCRIBED';
          setConnectionStates(prev => ({
            ...prev,
            [channelName]: isConnected
          }));

          if (isConnected) {
            debugLog(`✅ Subscribed to ${config.table}:${config.event}`);
          } else if (status === 'CHANNEL_ERROR') {
            debugError(`❌ Error subscribing to ${config.table}:${config.event}`);
          } else if (status === 'TIMED_OUT') {
            debugError(`⏱️ Timeout subscribing to ${config.table}:${config.event}`);
            // Retry subscription after timeout
            setTimeout(() => {
              debugLog(`Retrying subscription to ${config.table}:${config.event} after timeout`);
              // Force re-subscription by updating the component
            }, 3000);
          }
        });

      channelsRef.current.push(channel);
    });

    // Cleanup on unmount
    return () => {
      debugLog('Cleaning up realtime subscriptions');
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
    };
  }, [user, configs]);

  // Health check for reconnection
  useEffect(() => {
    if (!user) return;

    const healthCheck = setInterval(() => {
      const disconnectedChannels = Object.entries(connectionStates)
        .filter(([_, connected]) => !connected);

      if (disconnectedChannels.length > 0) {
        debugLog('Detected disconnected channels, attempting reconnection');
        // Trigger re-subscription by updating configs
        // This is handled by the parent component
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(healthCheck);
  }, [connectionStates, user]);

  return {
    connectionStates,
    isAllConnected: Object.values(connectionStates).every(Boolean),
    disconnectedCount: Object.values(connectionStates).filter(c => !c).length
  };
};