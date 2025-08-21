import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SubscriptionConfig {
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  callback: (payload: any) => void;
}

export const useRealtimeManager = (configs: SubscriptionConfig[]) => {
  const { user, loading } = useAuth();
  const channelsRef = useRef<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (loading || !user || !configs.length) return;

    // Clean up existing channels
    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel);
    });
    channelsRef.current = [];

    // Set up simple subscriptions
    configs.forEach((config, index) => {
      const channelName = `${config.table}_${index}`;
      
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
          config.callback
        )
        .subscribe((status) => {
          setIsConnected(status === 'SUBSCRIBED');
        });

      channelsRef.current.push(channel);
    });

    return () => {
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
    };
  }, [user, configs, loading]);

  return { isConnected };
};