import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { debugLog, debugError } from '@/lib/debug';
import { getDisplayName, createPresencePayload, type UserProfile } from '@/lib/displayNameResolver';

interface UserPresence {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  isOnline: boolean;
  lastSeen: string;
  status?: 'online' | 'away' | 'busy' | 'offline';
  currentWorld?: number;
}

type PresenceState = Record<string, any[]>;

export const usePresenceManager = (channelName = 'global_presence') => {
  const { user, loading } = useAuth();
  const [presenceState, setPresenceState] = useState<PresenceState>({});
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [channel, setChannel] = useState<any>(null);
  const [connectionRetries, setConnectionRetries] = useState(0);
  const [userProfile, setUserProfile] = useState<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  // Update user's online presence in database
  const updateUserPresence = useCallback(async (isOnline: boolean, status?: string) => {
    if (!user) return;

    try {
      const validStatus = status || (isOnline ? 'online' : 'offline');
      const { error } = await supabase
        .from('profiles')
        .update({
          is_online: isOnline,
          last_seen: new Date().toISOString(),
          status: validStatus
        })
        .eq('id', user.id);

      if (error) throw error;
      debugLog('Updated user presence:', { isOnline, status: validStatus });
    } catch (error) {
      debugError('Error updating user presence:', error);
    }
  }, [user]);

  // Load user profile for better presence data - memoized to prevent excessive calls
  useEffect(() => {
    if (loading || !user || userProfile) return; // Don't reload if already loaded

    let isMounted = true;
    
    const loadUserProfile = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, current_world')
          .eq('id', user.id)
          .single();
        
        if (profile && isMounted) {
          setUserProfile(profile);
          debugLog('Loaded user profile:', profile);
        }
      } catch (error) {
        if (isMounted) {
          debugError('Error loading user profile:', error);
        }
      }
    };

    loadUserProfile();
    
    return () => {
      isMounted = false;
    };
  }, [user, loading, userProfile]); // Add userProfile to deps to prevent reloading

  // Initialize presence tracking with retry logic
  useEffect(() => {
    if (loading || !user) {
      return;
    }

    console.log('✅ Initializing presence manager for:', user.email);
    debugLog('Initializing presence manager for:', user.email);

    // Clear any existing reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // Use standardized room-based channel naming for better stability
    const roomBasedChannelName = channelName.startsWith('room:') ? channelName : `room:${channelName}`;
    const presenceChannel = supabase.channel(roomBasedChannelName, {
      config: {
        presence: {
          key: user.id, // Use user ID as unique key
        },
      },
    });

    // Set up presence event listeners
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const newState = presenceChannel.presenceState();
        setPresenceState(newState);
        
        // Flatten presence state to get online users with consistent field names
        const users = Object.values(newState).flat().filter((p: any) => p && (p.userId || p.user_id)) as unknown as UserPresence[];
        // Normalize legacy presence data to new format
        const normalizedUsers = users.map(u => ({
          userId: (u as any).userId || (u as any).user_id,
          displayName: (u as any).displayName || getDisplayName({ 
            id: (u as any).userId || (u as any).user_id, 
            username: (u as any).username, 
            display_name: (u as any).display_name || (u as any).displayName 
          }),
          username: (u as any).username,
          avatarUrl: (u as any).avatarUrl || (u as any).avatar_url,
          isOnline: true,
          lastSeen: (u as any).lastSeen || (u as any).last_seen || new Date().toISOString(),
          status: (u as any).status || 'online',
          currentWorld: (u as any).currentWorld || (u as any).current_world
        }));
        setOnlineUsers(normalizedUsers);
        debugLog('Presence sync - online users:', normalizedUsers.length);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        debugLog('User joined:', key, newPresences);
        const validPresences = newPresences.filter((p: any) => p && (p.userId || p.user_id));
        const normalizedPresences = validPresences.map(p => ({
          userId: p.userId || p.user_id,
          displayName: p.displayName || getDisplayName({ 
            id: p.userId || p.user_id, 
            username: p.username, 
            display_name: p.display_name || p.displayName 
          }),
          username: p.username,
          avatarUrl: p.avatarUrl || p.avatar_url,
          isOnline: true,
          lastSeen: p.lastSeen || p.last_seen || new Date().toISOString(),
          status: p.status || 'online',
          currentWorld: p.currentWorld || p.current_world
        }));
        setOnlineUsers(prev => {
          const filtered = prev.filter(u => u.userId !== key);
          return [...filtered, ...normalizedPresences];
        });
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        debugLog('User left:', key, leftPresences);
        setOnlineUsers(prev => prev.filter(u => u.userId !== key));
      })
      .subscribe(async (status) => {
        console.log('🔗 Presence channel status:', status);
        setIsConnected(status === 'SUBSCRIBED');
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Connected to presence channel');
          debugLog('Connected to presence channel');
          
          // Update database presence
          await updateUserPresence(true, 'online');
          
          // Track user presence in channel using consistent display name resolver
          if (userProfile) {
            const presencePayload = createPresencePayload({
              id: user.id,
              username: userProfile.username,
              display_name: userProfile.display_name,
              avatar_url: userProfile.avatar_url
            });
            
            const presenceData: UserPresence = {
              userId: presencePayload.userId,
              displayName: presencePayload.displayName,
              username: presencePayload.username,
              avatarUrl: presencePayload.avatarUrl,
              isOnline: true,
              lastSeen: presencePayload.timestamp,
              status: 'online',
              currentWorld: userProfile?.current_world || 1
            };

            await presenceChannel.track(presenceData);
          }
        } else if (status === 'CLOSED') {
          console.log('❌ Disconnected from presence channel');
          debugLog('Disconnected from presence channel');
          setIsConnected(false);
          
          // Attempt reconnection with exponential backoff
          if (connectionRetries < 5) {
            const delay = Math.pow(2, connectionRetries) * 1000;
            reconnectTimeoutRef.current = setTimeout(() => {
              setConnectionRetries(prev => prev + 1);
            }, delay);
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Presence channel error');
          debugError('Presence channel error');
          setIsConnected(false);
          
          // Attempt reconnection
          if (connectionRetries < 5) {
            const delay = Math.pow(2, connectionRetries) * 1000;
            reconnectTimeoutRef.current = setTimeout(() => {
              setConnectionRetries(prev => prev + 1);
            }, delay);
          }
        }
      });

    setChannel(presenceChannel);

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      updateUserPresence(isVisible, isVisible ? 'online' : 'away');
      
      if (isVisible && presenceChannel && userProfile) {
        // Re-track presence when becoming visible using consistent format
        const presencePayload = createPresencePayload({
          id: user.id,
          username: userProfile.username,
          display_name: userProfile.display_name,
          avatar_url: userProfile.avatar_url
        });
        
        const presenceData: UserPresence = {
          userId: presencePayload.userId,
          displayName: presencePayload.displayName,
          username: presencePayload.username,
          avatarUrl: presencePayload.avatarUrl,
          isOnline: true,
          lastSeen: presencePayload.timestamp,
          status: 'online',
          currentWorld: userProfile?.current_world || 1
        };
        presenceChannel.track(presenceData);
      }
    };

    // Handle beforeunload to mark as offline
    const handleBeforeUnload = () => {
      updateUserPresence(false, 'offline');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Reset connection retries on successful connection
    if (isConnected) {
      setConnectionRetries(0);
    }

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (presenceChannel) {
        updateUserPresence(false, 'offline');
        supabase.removeChannel(presenceChannel);
      }
    };
  }, [user, userProfile, channelName, updateUserPresence, connectionRetries]);

  // Manual status update
  const setUserStatus = useCallback(async (status: 'online' | 'away' | 'busy' | 'offline') => {
    if (!user || !channel) return;

    await updateUserPresence(status !== 'offline', status);
    
    // Update presence in channel if online
    if (status !== 'offline' && userProfile) {
      const presencePayload = createPresencePayload({
        id: user.id,
        username: userProfile.username,
        display_name: userProfile.display_name,
        avatar_url: userProfile.avatar_url
      });
      
      const presenceData: UserPresence = {
        userId: presencePayload.userId,
        displayName: presencePayload.displayName,
        username: presencePayload.username,
        avatarUrl: presencePayload.avatarUrl,
        isOnline: true,
        lastSeen: presencePayload.timestamp,
        status,
        currentWorld: userProfile?.current_world || 1
      };
      await channel.track(presenceData);
    } else {
      await channel.untrack();
    }
  }, [user, channel, updateUserPresence]);

  // Get online friends
  const getOnlineFriends = useCallback((friendIds: string[]) => {
    return onlineUsers.filter(user => friendIds.includes(user.userId));
  }, [onlineUsers]);

  // Return safe defaults when not authenticated
  if (loading || !user) {
    return {
      presenceState: {},
      onlineUsers: [],
      isConnected: false,
      setUserStatus: async () => {},
      getOnlineFriends: () => [],
      updateUserPresence: async () => {}
    };
  }

  return {
    presenceState,
    onlineUsers,
    isConnected,
    setUserStatus,
    getOnlineFriends,
    updateUserPresence
  };
};