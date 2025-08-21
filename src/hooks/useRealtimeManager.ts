import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { debugLog, debugError } from '@/lib/debug';

export interface SubscriptionConfig {
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  callback: (payload: any) => void;
  // Advanced configuration options
  priority?: 'high' | 'medium' | 'low'; // For subscription prioritization
  throttleMs?: number; // Custom throttle duration
  dedupe?: boolean; // Remove duplicate events
  batchSize?: number; // Batch events together
}

interface RealtimeOptions {
  // Connection settings
  timeout?: number;
  heartbeatIntervalMs?: number;
  reconnectAfterMs?: number;
  maxReconnectAttempts?: number;
  // Performance settings
  enableThrottling?: boolean;
  enableBatching?: boolean;
  enableDeduplication?: boolean;
}

type ConnectionHealth = Record<string, boolean>;

interface EventBatch {
  events: any[];
  lastProcessed: number;
}

type EventCache = Record<string, {
    lastSeen: number;
    hash: string;
  }>;

// Centralized real-time subscription manager with performance optimizations
export const useRealtimeManager = (
  configs: SubscriptionConfig[], 
  options: RealtimeOptions = {}
) => {
  const { user, loading } = useAuth();
  const channelsRef = useRef<any[]>([]);
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>({});
  const [isReconnecting, setIsReconnecting] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  
  // Performance optimization refs
  const eventBatchRef = useRef<Record<string, EventBatch>>({});
  const eventCacheRef = useRef<EventCache>({});
  const batchTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Default options with performance focus - memoized to prevent dependency changes
  const defaultOptions: RealtimeOptions = useMemo(() => ({
    timeout: 15000, // Reduced from 20s
    heartbeatIntervalMs: 25000, // Reduced from 30s
    reconnectAfterMs: 2000, // Faster reconnection
    maxReconnectAttempts: 5,
    enableThrottling: true,
    enableBatching: true,
    enableDeduplication: true,
    ...options
  }), [options]);

  // Health check function (less noisy)
  const checkConnectionHealth = useCallback(() => {
    const totalConnections = Object.keys(connectionHealth).length;
    const healthyConnections = Object.values(connectionHealth).filter(Boolean).length;
    
    // Only log when there are actually unhealthy connections
    if (totalConnections > 0 && healthyConnections < totalConnections) {
      debugLog('Connection health check:', {
        total: totalConnections,
        healthy: healthyConnections,
        unhealthy: totalConnections - healthyConnections
      });
    }

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
    debugLog('Attempting real-time reconnection...');

    // Clean up existing channels
    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel);
    });
    channelsRef.current = [];
    setConnectionHealth({});

    // Exponential backoff: 2s, 4s, 8s, 16s, then cap at 30s
    const backoffDelay = Math.min(2000 * Math.pow(2, Math.min(reconnectAttempts.current, 4)), 30000);
    reconnectAttempts.current = Math.min(reconnectAttempts.current + 1, 5);
    
    debugLog(`Reconnection attempt ${reconnectAttempts.current} with ${backoffDelay}ms delay`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      setIsReconnecting(false);
      // The useEffect will reinitialize connections when isReconnecting becomes false
    }, backoffDelay);
  }, [isReconnecting]);

  // Event deduplication helper
  const createEventHash = useCallback((payload: any): string => {
    const key = `${payload.table}_${payload.eventType}_${payload.new?.id || payload.old?.id}`;
    const dataHash = JSON.stringify(payload.new || payload.old || {});
    return `${key}_${btoa(dataHash).slice(0, 12)}`;
  }, []);

  // Process batched events
  const processBatchedEvents = useCallback(() => {
    Object.entries(eventBatchRef.current).forEach(([configKey, batch]) => {
      if (batch.events.length === 0) return;
      
      const config = configs.find(c => `${c.table}_${c.event}` === configKey);
      if (!config) return;

      try {
        // Process as batch or individual events based on config
        if (config.batchSize && config.batchSize > 1) {
          config.callback({ type: 'batch', events: batch.events });
        } else {
          batch.events.forEach(event => config.callback(event));
        }
      } catch (error) {
        debugError(`Error processing batched events for ${configKey}:`, error);
      }

      // Clear processed events
      batch.events = [];
      batch.lastProcessed = Date.now();
    });
  }, [configs]);

  // Enhanced event handler with performance optimizations
  const handleRealtimeEvent = useCallback((config: SubscriptionConfig, payload: any) => {
    const now = Date.now();
    const configKey = `${config.table}_${config.event}`;
    
    // Deduplication check
    if (defaultOptions.enableDeduplication) {
      const eventHash = createEventHash(payload);
      const cached = eventCacheRef.current[eventHash];
      
      if (cached && (now - cached.lastSeen) < 1000) { // 1 second dedup window
        debugLog(`Deduplicated event for ${configKey}`);
        return;
      }
      
      eventCacheRef.current[eventHash] = { lastSeen: now, hash: eventHash };
    }

    // Throttling check with priority support
    const throttleMs = config.throttleMs || (config.priority === 'high' ? 50 : 100);
    const lastProcessed = eventBatchRef.current[configKey]?.lastProcessed || 0;
    
    if (defaultOptions.enableThrottling && (now - lastProcessed) < throttleMs) {
      return; // Skip if within throttle window
    }

    // Batching logic
    if (defaultOptions.enableBatching && config.batchSize && config.batchSize > 1) {
      if (!eventBatchRef.current[configKey]) {
        eventBatchRef.current[configKey] = { events: [], lastProcessed: 0 };
      }
      
      eventBatchRef.current[configKey].events.push(payload);
      
      // Process batch if full or after timeout
      if (eventBatchRef.current[configKey].events.length >= config.batchSize) {
        processBatchedEvents();
      } else {
        // Set batch timeout if not already set
        if (batchTimeoutRef.current) {
          clearTimeout(batchTimeoutRef.current);
        }
        batchTimeoutRef.current = setTimeout(processBatchedEvents, 100);
      }
    } else {
      // Process immediately for non-batched events
      try {
        config.callback(payload);
      } catch (error) {
        debugError(`Error in callback for ${configKey}:`, error);
      }
    }
  }, [defaultOptions, createEventHash, processBatchedEvents]);

  // Initialize subscriptions with debouncing
  useEffect(() => {
    if (loading || !user || !configs.length || isReconnecting) return;

    // Debounce subscription setup to avoid rapid reconnections
    const setupTimeout = setTimeout(() => {
      debugLog('Setting up real-time subscriptions:', configs.map(c => `${c.table}:${c.event}`));

      // Clean up existing channels first
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
      throttleTracker.current.clear();

      // Batch setup subscriptions with connection pooling
      const setupPromises = configs.map(async (config, index) => {
        const channelName = `${config.table}_${config.event}_${index}`;
        
        const channel = supabase
          .channel(channelName, {
            config: {
              broadcast: { self: false }, // Optimize bandwidth
              presence: { key: user.id },
              // Use optimized connection settings
              realtime: {
                timeout: defaultOptions.timeout,
                heartbeatIntervalMs: defaultOptions.heartbeatIntervalMs,
                reconnectAfterMs: defaultOptions.reconnectAfterMs
              }
            }
          })
          .on(
            'postgres_changes' as any,
            {
              event: config.event,
              schema: 'public',
              table: config.table,
              ...(config.filter && { filter: config.filter })
            },
            (payload) => {
              debugLog(`Real-time event received for ${config.table}:${config.event}`);
              handleRealtimeEvent(config, payload);
            }
          )
          .subscribe((status) => {
            const isConnected = status === 'SUBSCRIBED';
            
            setConnectionHealth(prev => ({
              ...prev,
              [channelName]: isConnected
            }));

            if (isConnected) {
              debugLog(`✅ Subscribed to ${config.table}:${config.event}`);
              // Reset reconnect attempts on successful connection
              reconnectAttempts.current = 0;
            } else if (status === 'CHANNEL_ERROR') {
              debugError(`❌ Error subscribing to ${config.table}:${config.event}`);
              // Delayed reconnection to avoid thrashing
              setTimeout(() => attemptReconnection(), 5000);
            } else if (status === 'TIMED_OUT') {
              debugError(`⏱️ Timeout subscribing to ${config.table}:${config.event}`);
              // Retry connection with exponential backoff to handle timeouts
              setTimeout(() => attemptReconnection(), 3000);
            } else if (status === 'CLOSED') {
              debugLog(`🔒 Channel closed for ${config.table}:${config.event}`);
              setConnectionHealth(prev => ({
                ...prev,
                [channelName]: false
              }));
            }
          });

        channelsRef.current.push(channel);
        return channel;
      });

      // Wait for all channels to be set up
      Promise.all(setupPromises).then(() => {
        debugLog('All real-time subscriptions initialized');
      }).catch(error => {
        debugError('Error setting up subscriptions:', error);
      });
    }, 500); // 500ms debounce

    // Cleanup on unmount
    return () => {
      debugLog('Cleaning up real-time subscriptions');
      
      // Clean up channels
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
      setConnectionHealth({});
      
      // Clean up timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      
      // Clean up performance optimization refs
      eventBatchRef.current = {};
      eventCacheRef.current = {};
      
      // Process any remaining batched events before cleanup
      processBatchedEvents();
    };
  }, [user, configs, isReconnecting, attemptReconnection]);

  // Periodic health monitoring (less frequent)
  useEffect(() => {
    if (loading || !user) return;

    const healthCheckInterval = setInterval(() => {
      const health = checkConnectionHealth();
      
      // Only reconnect if there are many unhealthy connections
      if (!health.isAllHealthy && health.unhealthyCount > 1) {
        debugLog('Multiple unhealthy connections detected, scheduling reconnection');
        setTimeout(() => attemptReconnection(), 5000);
      }
    }, 60000); // Check every 60 seconds (less frequent)

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