import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { debugLog, debugError } from '@/lib/debug';

interface EnhancedPresence {
  user_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  last_seen: Date;
  session_id?: string;
}

export const useEnhancedPresenceManager = (sessionId: string | null) => {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<EnhancedPresence[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const channelRef = useRef<any>();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Update user presence with session context
  const updateSessionPresence = useCallback(async (status: 'online' | 'away' | 'busy' | 'offline') => {
    if (!user || !sessionId) return;

    try {
      // Update profile presence
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          is_online: status === 'online',
          status,
          last_seen: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Broadcast presence to session channel
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'presence_update',
          payload: {
            user_id: user.id,
            session_id: sessionId,
            status,
            timestamp: new Date().toISOString()
          }
        });
      }

      debugLog('🟢 Updated session presence:', { sessionId, status });
    } catch (error) {
      debugError('🔴 Error updating session presence:', error);
    }
  }, [user, sessionId]);

  // Start presence heartbeat
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    // Send heartbeat every 15 seconds
    heartbeatIntervalRef.current = setInterval(async () => {
      if (user && sessionId) {
        await updateSessionPresence('online');
        debugLog('💓 Presence heartbeat sent');
      }
    }, 15000);

    debugLog('💓 Started presence heartbeat');
  }, [user, sessionId, updateSessionPresence]);

  // Stop presence heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = undefined;
      debugLog('💔 Stopped presence heartbeat');
    }
  }, []);

  // Attempt reconnection with exponential backoff
  const attemptReconnection = useCallback(() => {
    if (isReconnecting || !sessionId || !user) return;

    setIsReconnecting(true);
    debugLog('🔄 Attempting presence reconnection...');

    const reconnectDelay = Math.min(1000 * Math.pow(2, 3), 10000); // Cap at 10s

    reconnectTimeoutRef.current = setTimeout(async () => {
      try {
        // Try to reconnect to presence channel
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current);
        }

        // Set up fresh channel
        setupPresenceChannel();
        
        setIsReconnecting(false);
        debugLog('✅ Presence reconnection successful');
      } catch (error) {
        debugError('❌ Presence reconnection failed:', error);
        setIsReconnecting(false);
        // Try again with longer delay
        setTimeout(() => attemptReconnection(), reconnectDelay);
      }
    }, reconnectDelay);
  }, [isReconnecting, sessionId, user]);

  // Setup presence channel
  const setupPresenceChannel = useCallback(() => {
    if (!sessionId || !user) return;

    const channelName = `presence:${sessionId}`;
    debugLog('🟢 Setting up presence channel:', channelName);

    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'presence_update' }, (payload) => {
        const { user_id, status, timestamp } = payload.payload;
        debugLog('🟢 Received presence update:', { user_id, status });

        // Update local presence state
        setOnlineUsers(prev => {
          const filtered = prev.filter(u => u.user_id !== user_id);
          
          if (status === 'offline') {
            return filtered;
          }

          // Fetch user profile if not already known
          supabase
            .from('profiles')
            .select('username, display_name, avatar_url')
            .eq('id', user_id)
            .single()
            .then(({ data }) => {
              if (data) {
                setOnlineUsers(current => {
                  const existing = current.find(u => u.user_id === user_id);
                  if (existing) {
                    return current.map(u => 
                      u.user_id === user_id 
                        ? { ...u, status, last_seen: new Date(timestamp) }
                        : u
                    );
                  } else {
                    return [...current, {
                      user_id,
                      username: data.username,
                      display_name: data.display_name,
                      avatar_url: data.avatar_url,
                      status,
                      last_seen: new Date(timestamp),
                      session_id: sessionId
                    }];
                  }
                });
              }
            });

          return filtered;
        });
      })
      .subscribe((status) => {
        debugLog('🟢 Presence channel status:', status);
        
        switch (status) {
          case 'SUBSCRIBED':
            setConnectionStatus('connected');
            startHeartbeat();
            // Announce our presence
            updateSessionPresence('online');
            break;
          case 'CHANNEL_ERROR':
          case 'TIMED_OUT':
            setConnectionStatus('disconnected');
            stopHeartbeat();
            attemptReconnection();
            break;
          case 'CLOSED':
            setConnectionStatus('disconnected');
            stopHeartbeat();
            break;
        }
      });

    channelRef.current = channel;
  }, [sessionId, user, startHeartbeat, stopHeartbeat, updateSessionPresence, attemptReconnection]);

  // Initialize presence management
  useEffect(() => {
    if (!sessionId || !user) {
      setOnlineUsers([]);
      setConnectionStatus('disconnected');
      return;
    }

    setConnectionStatus('connecting');
    setupPresenceChannel();

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateSessionPresence('online');
        if (!heartbeatIntervalRef.current) {
          startHeartbeat();
        }
      } else {
        updateSessionPresence('away');
      }
    };

    // Handle page unload
    const handleBeforeUnload = () => {
      updateSessionPresence('offline');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // Cleanup
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      stopHeartbeat();
      updateSessionPresence('offline');

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [sessionId, user, setupPresenceChannel, updateSessionPresence, startHeartbeat, stopHeartbeat]);

  // Cleanup stale presence every 2 minutes
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = new Date();
      setOnlineUsers(prev => prev.filter(user => {
        const timeSinceLastSeen = now.getTime() - user.last_seen.getTime();
        return timeSinceLastSeen < 90000; // 90 seconds
      }));
    }, 120000); // 2 minutes

    return () => clearInterval(cleanupInterval);
  }, []);

  return {
    onlineUsers,
    connectionStatus,
    isReconnecting,
    updateSessionPresence,
    startHeartbeat,
    stopHeartbeat
  };
};