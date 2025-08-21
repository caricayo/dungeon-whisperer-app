import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

interface ConnectionHealth {
  isOnline: boolean;
  isSupabaseConnected: boolean;
  lastPingTime: number | null;
  reconnectAttempts: number;
  isReconnecting: boolean;
}

export const useConnectionStabilizer = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [health, setHealth] = useState<ConnectionHealth>({
    isOnline: navigator.onLine,
    isSupabaseConnected: true,
    lastPingTime: null,
    reconnectAttempts: 0,
    isReconnecting: false
  });

  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pingIntervalRef = useRef<NodeJS.Timeout>();

  // Enhanced connection test with timeout
  const testConnection = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const { error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .limit(1)
        .abortSignal(controller.signal);
      
      clearTimeout(timeoutId);
      
      if (error) {
        console.warn('Connection test failed:', error.message);
        return false;
      }
      
      return true;
    } catch {
      console.warn('Connection test error:', _error);
      return false;
    }
  }, [user]);

  // Smart reconnection with exponential backoff
  const attemptReconnection = useCallback(async () => {
    if (health.isReconnecting ?? health.reconnectAttempts >= 5) return;

    setHealth(prev => ({ 
      ...prev, 
      isReconnecting: true, 
      reconnectAttempts: prev.reconnectAttempts + 1 
    }));

    try {
      // Wait before attempting reconnection (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, health.reconnectAttempts), 30000);
      await new Promise(resolve => setTimeout(resolve, delay));

      const isConnected = await testConnection();
      
      setHealth(prev => ({
        ...prev,
        isSupabaseConnected: isConnected,
        lastPingTime: Date.now(),
        isReconnecting: false,
        reconnectAttempts: isConnected ? 0 : prev.reconnectAttempts
      }));

      if (isConnected) {
        toast({
          title: "Connection Restored",
          description: "Successfully reconnected to the server.",
        });
      } else if (health.reconnectAttempts < 5) {
        // Schedule next attempt
        reconnectTimeoutRef.current = setTimeout(() => attemptReconnection(), delay);
      } else {
        toast({
          title: "Connection Failed",
          description: "Unable to reconnect. Please check your internet connection.",
          variant: "destructive",
        });
      }
    } catch {
      console.error('Reconnection attempt failed:', _error);
      setHealth(prev => ({ ...prev, isReconnecting: false }));
    }
  }, [health.reconnectAttempts, health.isReconnecting, testConnection, toast]);

  // Regular health monitoring
  const startHealthMonitoring = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    pingIntervalRef.current = setInterval(async () => {
      if (!health.isReconnecting) {
        const isConnected = await testConnection();
        
        setHealth(prev => {
          const wasConnected = prev.isSupabaseConnected;
          
          if (!isConnected && wasConnected) {
            // Connection lost - start reconnection
            setTimeout(() => attemptReconnection(), 1000);
          }
          
          return {
            ...prev,
            isSupabaseConnected: isConnected,
            lastPingTime: Date.now(),
            reconnectAttempts: isConnected ? 0 : prev.reconnectAttempts
          };
        });
      }
    }, 30000); // Check every 30 seconds
  }, [testConnection, attemptReconnection, health.isReconnecting]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setHealth(prev => ({ ...prev, isOnline: true, reconnectAttempts: 0 }));
      // Test connection when coming back online
      setTimeout(testConnection, 1000);
    };

    const handleOffline = () => {
      setHealth(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [testConnection]);

  // Start monitoring when user is available
  useEffect(() => {
    if (user && health.isOnline) {
      startHealthMonitoring();
    }

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [user, health.isOnline, startHealthMonitoring]);

  // Force manual reconnection
  const forceReconnect = useCallback(() => {
    setHealth(prev => ({ ...prev, reconnectAttempts: 0 }));
    attemptReconnection();
  }, [attemptReconnection]);

  return {
    ...health,
    forceReconnect,
    isHealthy: health.isOnline && health.isSupabaseConnected,
    connectionStrength: health.isOnline && health.isSupabaseConnected ? 'strong' : 
                       health.isOnline ? 'weak' : 'offline'
  };
};
