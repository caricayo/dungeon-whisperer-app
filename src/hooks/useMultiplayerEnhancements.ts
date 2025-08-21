import { useMemo } from 'react';
import { useRealtimeManager } from '@/hooks/useRealtimeManager';
import { usePresenceManager } from '@/hooks/usePresenceManager';
import { useAuth } from '@/hooks/use-auth';

// Enhanced multiplayer functionality with real-time updates
export const useMultiplayerEnhancements = () => {
  const { user, loading } = useAuth();
  const { onlineUsers, isConnected } = usePresenceManager('multiplayer_sessions');

  // Set up real-time subscriptions for multiplayer tables
  const realtimeConfigs = useMemo(() => {
    if (loading || !user) return [];
    
    return [
      {
        table: 'sessions',
        event: 'UPDATE' as const,
        callback: () => {
          // Refresh multiplayer sessions when updated
          window.dispatchEvent(new CustomEvent('multiplayer-session-updated'));
        }
      },
      {
        table: 'session_participants',
        event: 'INSERT' as const,
        callback: () => {
          // New participant joined
          window.dispatchEvent(new CustomEvent('multiplayer-participant-joined'));
        }
      },
      {
        table: 'session_participants',
        event: 'DELETE' as const,
        callback: () => {
          // Participant left
          window.dispatchEvent(new CustomEvent('multiplayer-participant-left'));
        }
      },
      {
        table: 'session_invites',
        event: 'INSERT' as const,
        callback: () => {
          // New invite received
          window.dispatchEvent(new CustomEvent('multiplayer-invite-received'));
        }
      },
      {
        table: 'session_invites',
        event: 'UPDATE' as const,
        callback: () => {
          // Invite status updated
          window.dispatchEvent(new CustomEvent('multiplayer-invite-updated'));
        }
      }
    ];
  }, [user, loading]);

  const { 
    connectionHealth, 
    isAllHealthy, 
    healthyCount, 
    totalCount, 
    unhealthyCount,
    isReconnecting 
  } = useRealtimeManager(realtimeConfigs);

  // Get online participants for a specific session
  const getOnlineParticipants = (participantIds: string[]) => {
    return onlineUsers.filter(user => participantIds.includes(user.userId));
  };

  // Return safe defaults when not authenticated
  if (loading || !user) {
    return {
      onlineUsers: [],
      getOnlineParticipants: () => [],
      isRealtimeConnected: false,
      areConnectionsHealthy: true,
      connectionHealth: {},
      healthyCount: 0,
      totalCount: 0,
      unhealthyCount: 0,
      isReconnecting: false
    };
  }

  return {
    onlineUsers,
    getOnlineParticipants,
    isRealtimeConnected: isConnected,
    areConnectionsHealthy: isAllHealthy,
    connectionHealth,
    healthyCount,
    totalCount,
    unhealthyCount,
    isReconnecting
  };
};
