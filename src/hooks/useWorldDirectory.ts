import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { debugLog, debugError } from '@/lib/debug';
import { getDisplayName } from '@/lib/displayNameResolver';

export interface WorldUser {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  is_online: boolean;
  last_seen: string | null;
  current_world: number;
  resolvedDisplayName: string;
}

export const useWorldDirectory = () => {
  const { user } = useAuth();
  const [allUsers, setAllUsers] = useState<WorldUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAllUsers = useCallback(async () => {
    if (!user) {
      setAllUsers([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      debugLog('Loading world directory users...');
      
      const { data, error: rpcError } = await supabase
        .rpc('get_all_users_safe');

      if (rpcError) {
        debugError('Error loading world directory:', rpcError);
        throw rpcError;
      }

      if (data) {
        const usersWithDisplayNames: WorldUser[] = data.map((user: any) => ({
          ...user,
          resolvedDisplayName: getDisplayName({
            id: user.id,
            username: user.username,
            display_name: user.display_name,
            avatar_url: user.avatar_url
          })
        }));

        setAllUsers(usersWithDisplayNames);
        debugLog('Loaded world directory users:', usersWithDisplayNames.length);
      }
    } catch (error: any) {
      debugError('Error loading world directory:', error);
      setError(error?.message || 'Failed to load world directory');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAllUsers();
  }, [loadAllUsers]);

  // Set up real-time updates for user profiles
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('world_directory_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles'
      }, (payload) => {
        debugLog('Profile update detected, reloading world directory');
        loadAllUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadAllUsers]);

  return {
    allUsers,
    isLoading,
    error,
    reload: loadAllUsers
  };
};