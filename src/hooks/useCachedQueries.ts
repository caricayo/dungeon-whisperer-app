/**
 * Cached query hooks for improved performance
 * Wraps Supabase queries with intelligent caching
 */

import { useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from '@/contexts/AuthContext';
import { cachedQuery, invalidateTableCache, CacheTTL } from '@/lib/query-cache';
import { debugLog } from '@/lib/debug';

export const useCachedQueries = () => {
  const { user } = useAuth();

  // Cached session loading with smart invalidation
  const loadSessionsCached = useCallback(async () => {
    if (!user) return { data: null, error: null };

    return cachedQuery(
      async () => {
        debugLog('Loading sessions from Supabase (cache miss)');
        
        // Load owned sessions
        const { data: ownedSessions, error: ownedError } = await supabase
          .from('sessions')
          .select('*')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false });

        if (ownedError) return { data: null, error: ownedError };

        // Load participated sessions
        const { data: participantData, error: participantError } = await supabase
          .from('session_participants')
          .select('session_id')
          .eq('user_id', user.id);

        let participatedSessions = [];
        if (!participantError && participantData && participantData.length > 0) {
          const sessionIds = participantData.map(p => p.session_id);
          
          const result = await supabase
            .from('sessions')
            .select('*')
            .neq('user_id', user.id)
            .in('id', sessionIds)
            .is('deleted_at', null)
            .order('updated_at', { ascending: false });
            
          participatedSessions = result.data || [];
        }

        const allSessions = [
          ...(ownedSessions || []),
          ...participatedSessions
        ];

        return { data: allSessions, error: null };
      },
      {
        table: 'sessions',
        query: 'loadUserSessions',
        params: { userId: user.id }
      },
      {
        ttl: CacheTTL.MEDIUM // 5 minutes cache
      }
    );
  }, [user]);

  // Cached profile loading
  const loadProfileCached = useCallback(async (profileId: string) => {
    return cachedQuery(
      async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, is_online, last_seen')
          .eq('id', profileId)
          .single();

        return { data, error };
      },
      {
        table: 'profiles',
        query: 'getProfile',
        params: { profileId }
      },
      {
        ttl: CacheTTL.MEDIUM
      }
    );
  }, []);

  // Cached user settings loading
  const loadUserSettingsCached = useCallback(async (targetUserId?: string) => {
    if (!user && !targetUserId) return { data: null, error: null };
    
    const userId = targetUserId || user?.id;
    
    return cachedQuery(
      async () => {
        const { data, error } = await supabase
          .rpc('get_safe_user_settings', { target_user_id: userId });

        return { data, error };
      },
      {
        table: 'user_settings',
        query: 'getSafeSettings',
        params: { userId }
      },
      {
        ttl: CacheTTL.LONG // 30 minutes cache for settings
      }
    );
  }, [user]);

  // Cached campaign loading with member data
  const loadCampaignCached = useCallback(async (campaignId: string) => {
    if (!user) return { data: null, error: null };

    return cachedQuery(
      async () => {
        const { data: campaign, error: campaignError } = await supabase
          .from('campaigns')
          .select(`
            *,
            campaign_members!inner(
              id,
              role,
              joined_at,
              profiles!inner(
                id,
                username,
                display_name,
                avatar_url
              )
            )
          `)
          .eq('id', campaignId)
          .single();

        return { data: campaign, error: campaignError };
      },
      {
        table: 'campaigns',
        query: 'getCampaignWithMembers',
        params: { campaignId, userId: user.id }
      },
      {
        ttl: CacheTTL.MEDIUM
      }
    );
  }, [user]);

  // Cached session participants loading
  const loadSessionParticipantsCached = useCallback(async (sessionId: string) => {
    return cachedQuery(
      async () => {
        const { data, error } = await supabase
          .from('session_participants')
          .select(`
            *,
            profiles!inner(
              id,
              username,
              display_name,
              avatar_url,
              is_online
            )
          `)
          .eq('session_id', sessionId);

        return { data, error };
      },
      {
        table: 'session_participants',
        query: 'getSessionParticipants',
        params: { sessionId }
      },
      {
        ttl: CacheTTL.SHORT // 30 seconds for participant data
      }
    );
  }, []);

  // Cached discoverable sessions
  const loadDiscoverableSessionsCached = useCallback(async () => {
    return cachedQuery(
      async () => {
        const { data, error } = await supabase
          .rpc('get_discoverable_sessions_for_current_world');

        return { data, error };
      },
      {
        table: 'sessions',
        query: 'getDiscoverableSessions',
        params: {}
      },
      {
        ttl: CacheTTL.SHORT // 30 seconds for discoverable sessions
      }
    );
  }, []);

  // Cache invalidation helpers
  const invalidateSessionsCache = useCallback(() => {
    const count = invalidateTableCache('sessions');
    debugLog(`Invalidated ${count} session cache entries`);
  }, []);

  const invalidateProfilesCache = useCallback(() => {
    const count = invalidateTableCache('profiles');
    debugLog(`Invalidated ${count} profile cache entries`);
  }, []);

  const invalidateCampaignsCache = useCallback(() => {
    const count = invalidateTableCache('campaigns');
    debugLog(`Invalidated ${count} campaign cache entries`);
  }, []);

  // Smart cache invalidation based on real-time events
  const handleRealtimeInvalidation = useCallback((payload: any) => {
    const { table, eventType } = payload;
    
    switch (table) {
      case 'sessions':
        invalidateSessionsCache();
        break;
      case 'session_participants':
        invalidateTableCache('session_participants');
        invalidateSessionsCache(); // Sessions cache depends on participants
        break;
      case 'profiles':
        invalidateProfilesCache();
        break;
      case 'campaigns':
      case 'campaign_members':
        invalidateCampaignsCache();
        break;
      case 'user_settings':
        invalidateTableCache('user_settings');
        break;
      default:
        // For unknown tables, just invalidate that specific table
        invalidateTableCache(table);
    }
  }, [invalidateSessionsCache, invalidateProfilesCache, invalidateCampaignsCache]);

  return {
    // Cached query functions
    loadSessionsCached,
    loadProfileCached,
    loadUserSettingsCached,
    loadCampaignCached,
    loadSessionParticipantsCached,
    loadDiscoverableSessionsCached,
    
    // Cache invalidation functions
    invalidateSessionsCache,
    invalidateProfilesCache,
    invalidateCampaignsCache,
    handleRealtimeInvalidation
  };
};