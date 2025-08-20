import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { debugLog, debugError } from '@/lib/debug';

export interface RealtimeConfig {
  roomId: string;
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  callback: (payload: any) => void;
}

type ConnectionHealth = Record<string, boolean>;

/**
 * Standardized realtime manager with Context-7 Doc Assist compliant channel naming
 * Uses format: room:{sessionId} for all multiplayer sessions
 */
export const useStandardizedRealtime = (configs: RealtimeConfig[]) => {
  const { user, loading } = useAuth();
  const channelsRef = useRef<any[]>([]);
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>({});
  const [isReconnecting, setIsReconnecting] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  // Health check function
  const checkConnectionHealth = useCallback(() => {
    const totalConnections = Object.keys(connectionHealth).length;
    const healthyConnections = Object.values(connectionHealth).filter(Boolean).length;
    
    debugLog('[StandardizedRealtime] Connection health check:', {
      total: totalConnections,
      healthy: healthyConnections,
      unhealthy: totalConnections - healthyConnections
    });

    return {
      isAllHealthy: totalConnections === 0 || healthyConnections === totalConnections,
      healthyCount: healthyConnections,
      totalCount: totalConnections,
      unhealthyCount: totalConnections - healthyConnections
    };
  }, [connectionHealth]);

  // Reconnection logic with exponential backoff
  const attemptReconnection = useCallback(() => {
    if (isReconnecting) return;
    
    setIsReconnecting(true);
    debugLog('[StandardizedRealtime] Attempting reconnection...');

    // Clean up existing channels
    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel);
    });
    channelsRef.current = [];
    setConnectionHealth({});

    // Retry after 2 seconds
    reconnectTimeoutRef.current = setTimeout(() => {
      setIsReconnecting(false);
    }, 2000);
  }, [isReconnecting]);

  // Initialize subscriptions
  useEffect(() => {
    if (loading || !user || !configs.length || isReconnecting) return;

    debugLog('[StandardizedRealtime] Setting up subscriptions:', configs.map(c => `room:${c.roomId}`));

    // Clean up existing channels first
    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel);
    });
    channelsRef.current = [];

    // Set up new subscriptions with standardized naming
    configs.forEach((config) => {
      const channelName = `room:${config.roomId}`;
      
      debugLog(`[StandardizedRealtime] Creating channel: ${channelName}`);
      
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
            debugLog(`[StandardizedRealtime] Update on ${channelName}:`, payload);
            try {
              config.callback(payload);
            } catch (error) {
              debugError(`[StandardizedRealtime] Callback error for ${channelName}:`, error);
            }
          }
        )
        .subscribe((status) => {
          const isConnected = status === 'SUBSCRIBED';
          
          setConnectionHealth(prev => ({
            ...prev,
            [channelName]: isConnected
          }));

          if (isConnected) {
            debugLog(`✅ [StandardizedRealtime] Subscribed to ${channelName}`);
          } else if (status === 'CHANNEL_ERROR') {
            debugError(`❌ [StandardizedRealtime] Error subscribing to ${channelName}`);
            setTimeout(() => attemptReconnection(), 5000);
          } else if (status === 'TIMED_OUT') {
            debugError(`⏱️ [StandardizedRealtime] Timeout subscribing to ${channelName}`);
            setTimeout(() => attemptReconnection(), 3000);
          } else if (status === 'CLOSED') {
            debugLog(`🔒 [StandardizedRealtime] Channel closed: ${channelName}`);
            setConnectionHealth(prev => ({
              ...prev,
              [channelName]: false
            }));
          }
        });

      channelsRef.current.push(channel);
    });

    // Cleanup on unmount
    return () => {
      debugLog('[StandardizedRealtime] Cleaning up subscriptions');
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
      setConnectionHealth({});
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [user, configs, isReconnecting, attemptReconnection]);

  // Periodic health monitoring
  useEffect(() => {
    if (loading || !user) return;

    const healthCheckInterval = setInterval(() => {
      const health = checkConnectionHealth();
      
      if (!health.isAllHealthy && health.totalCount > 0) {
        debugLog('[StandardizedRealtime] Unhealthy connections detected, scheduling reconnection');
        setTimeout(() => attemptReconnection(), 1000);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(healthCheckInterval);
  }, [user, checkConnectionHealth, attemptReconnection]);

  // Return safe defaults when not authenticated
  if (loading || !user) {
    return {
      connectionHealth: {},
      isAllHealthy: true,
      healthyCount: 0,
      totalCount: 0,
      unhealthyCount: 0,
      isReconnecting: false,
      attemptReconnection: () => { /* No-op when not authenticated */ }
    };
  }

  const health = checkConnectionHealth();

  return {
    connectionHealth,
    isAllHealthy: health.isAllHealthy,
    healthyCount: health.healthyCount,
    totalCount: health.totalCount,
    unhealthyCount: health.unhealthyCount,
    isReconnecting,
    attemptReconnection
  };
};