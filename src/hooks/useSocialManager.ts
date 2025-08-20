import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { debugLog, debugError } from '@/lib/debug';
import { useRealtimeSubscriptions } from '@/hooks/useRealtimeSubscriptions';
import { usePresenceManager } from '@/hooks/usePresenceManager';

export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
  updated_at: string;
  friend_profile?: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    is_online?: boolean;
    last_seen?: string;
  };
  requester_profile?: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    is_online?: boolean;
    last_seen?: string;
  };
}

export const useSocialManager = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  
  // Enhanced presence and realtime functionality
  const { onlineUsers, getOnlineFriends } = usePresenceManager();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Realtime subscription configs
  const realtimeConfigs = useMemo(() => {
    if (loading || !user) return [];
    
    return [
      {
        table: 'friendships',
        event: 'INSERT' as const,
        callback: () => loadFriends()
      },
      {
        table: 'friendships',
        event: 'UPDATE' as const,
        callback: () => loadFriends()
      },
      {
        table: 'friendships',
        event: 'DELETE' as const,
        callback: () => loadFriends()
      },
      {
        table: 'profiles',
        event: 'UPDATE' as const,
        callback: () => loadFriends() // Refresh when profiles update (online status, etc.)
      }
    ];
  }, [user]);

  // Set up realtime subscriptions
  const { connectionStates } = useRealtimeSubscriptions(realtimeConfigs);

  const loadFriends = async () => {
    if (loading || !user) return;
    
    setIsLoading(true);
    try {
      const { data: friendsData, error: friendsError } = await supabase
        .from('friendships')
        .select(`
          *,
          friend_profile:profiles!friendships_friend_id_fkey(
            id, username, display_name, avatar_url, is_online, last_seen
          ),
          requester_profile:profiles!friendships_user_id_fkey(
            id, username, display_name, avatar_url, is_online, last_seen
          )
        `)
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted');

      const { data: requestsData, error: requestsError } = await supabase
        .from('friendships')
        .select(`
          *,
          friend_profile:profiles!friendships_friend_id_fkey(
            id, username, display_name, avatar_url, is_online, last_seen
          ),
          requester_profile:profiles!friendships_user_id_fkey(
            id, username, display_name, avatar_url, is_online, last_seen
          )
        `)
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'pending');

      if (friendsError) throw friendsError;
      if (requestsError) throw requestsError;

      setFriends(friendsData || []);
      setFriendRequests(requestsData || []);

    } catch (error) {
      debugError('Error loading friends:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendFriendRequest = async (username: string) => {
    if (!user) return false;

    try {
      const { data, error } = await supabase.rpc('send_friend_request', {
        target_username: username.trim()
      });

      if (error) throw error;

      const result = data as { success: boolean; message?: string; error?: string };
      
      if (result?.success) {
        toast({
          title: "Friend Request Sent",
          description: result.message || `Friend request sent to ${username}!`,
        });
        await loadFriends();
        return true;
      } else {
        toast({
          title: "Unable to Send Request",
          description: result?.error || "Failed to send friend request.",
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      debugError('Error sending friend request:', error);
      const description = error?.message || error?.hint || error?.details || 'Failed to send friend request.';
      toast({
        title: 'Error',
        description,
        variant: 'destructive',
      });
      return false;
    }
  };

  const sendFriendRequestByUserId = async (targetUserId: string) => {
    if (!user) return false;

    try {
      const { data, error } = await supabase.rpc('send_friend_request_by_user_id', {
        target_user_id: targetUserId
      });

      if (error) throw error;

      const result = data as { success: boolean; message?: string; error?: string };
      
      if (result?.success) {
        toast({
          title: "Friend Request Sent",
          description: result.message || "Friend request sent!",
        });
        await loadFriends();
        return true;
      } else {
        toast({
          title: "Unable to Send Request",
          description: result?.error || "Failed to send friend request.",
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      debugError('Error sending friend request by user ID:', error);
      const description = error?.message || error?.hint || error?.details || 'Failed to send friend request.';
      toast({
        title: 'Error',
        description,
        variant: 'destructive',
      });
      return false;
    }
  };

  const acceptFriendRequest = async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId);

      if (error) throw error;
      
      toast({
        title: "Friend Request Accepted",
        description: "You are now friends!",
      });

      await loadFriends();
      return true;
    } catch (error) {
      return false;
    }
  };

  const declineFriendRequest = async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      if (error) throw error;
      
      await loadFriends();
      return true;
    } catch (error) {
      return false;
    }
  };

  // Get online friends with enhanced presence data
  const friendsWithPresence = useMemo(() => {
    const friendIds = friends.map(f => 
      f.user_id === user?.id ? f.friend_id : f.user_id
    );
    const onlineFriends = getOnlineFriends(friendIds);
    
    return friends.map(friend => {
      const friendId = friend.user_id === user?.id ? friend.friend_id : friend.user_id;
      const onlineData = onlineFriends.find(u => u.user_id === friendId);
      
      return {
        ...friend,
        friend_profile: {
          ...friend.friend_profile,
          is_online: onlineData?.is_online || false,
          last_seen: onlineData?.last_seen || friend.friend_profile?.last_seen
        }
      };
    });
  }, [friends, onlineUsers, getOnlineFriends, user?.id]);

  useEffect(() => {
    if (!loading && user) {
      loadFriends();
    }
  }, [user, loading]);

  // Return safe defaults when not authenticated
  if (loading || !user) {
    return {
      friends: [],
      friendRequests: [],
      isLoading: false,
      loadFriends: async () => {},
      sendFriendRequest: async () => false,
      sendFriendRequestByUserId: async () => false,
      acceptFriendRequest: async () => false,
      declineFriendRequest: async () => false,
      onlineUsers: [],
      connectionStates: {},
    };
  }

  return {
    friends: friendsWithPresence,
    friendRequests,
    isLoading,
    loadFriends,
    sendFriendRequest,
    sendFriendRequestByUserId,
    acceptFriendRequest,
    declineFriendRequest,
    onlineUsers,
    connectionStates,
  };
};