import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { debugLog, debugError } from '@/lib/debug';
import { useMultiplayerEnhancements } from '@/hooks/useMultiplayerEnhancements';
import { useMultiplayerRealtime } from '@/hooks/useMultiplayerRealtime';
import type { Message } from '@/hooks/useSessionManager';

interface RawParticipantData {
  id: string;
  session_id: string;
  user_id: string;
  role: string;
  permissions: string;
  joined_at: string;
}

interface RawProfileData {
  id: string;
  username?: string;
  display_name?: string;
  is_online?: boolean;
  avatar_url?: string;
}

interface PermissionsObject {
  canInvite?: boolean;
  can_invite?: boolean;
}

export interface SessionInvite {
  id: string;
  sessionId: string;
  inviterId: string;
  inviteeId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  updatedAt: Date;
  session?: {
    name: string;
    isMultiplayer: boolean;
  };
  inviter?: {
    username: string;
    displayName?: string;
  };
}

export interface SessionParticipant {
  id: string;
  sessionId: string;
  userId: string;
  role: 'dm' | 'player';
  permissions: {
    canInvite: boolean;
  };
  joinedAt: Date;
  profile?: {
    username: string;
    displayName?: string;
    isOnline?: boolean;
  };
}

export interface MultiplayerSession {
  id: string;
  name: string;
  isMultiplayer: boolean;
  maxPlayers: number;
  currentPlayerCount: number;
  participants: SessionParticipant[];
  messages: Message[];
  customPrompt?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export const useMultiplayerSessions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Enhanced multiplayer functionality
  const { onlineUsers, getOnlineParticipants, areConnectionsHealthy } = useMultiplayerEnhancements();
  
  const [multiplayerSessions, setMultiplayerSessions] = useState<MultiplayerSession[]>([]);
  const [sessionInvites, setSessionInvites] = useState<SessionInvite[]>([]);
  const [discoverableSessions, setDiscoverableSessions] = useState<MultiplayerSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Optimized multiplayer data loading - parallel queries
  const loadMultiplayerData = useCallback(async (retryCount = 0) => {
    if (!user) return;

    setIsLoading(true);
    debugLog(`Loading multiplayer data (attempt ${retryCount + 1})`);

    try {
      // PARALLEL LOADING - Execute all queries simultaneously
      const [sessionsResult, invitesResult, discoverableResult] = await Promise.allSettled([
        // Sessions query - simplified to avoid complex joins
        supabase
          .from('sessions')
          .select('id, name, is_multiplayer, max_players, current_player_count, messages, custom_prompt, created_at, updated_at')
          .eq('is_multiplayer', true)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(20), // Limit results for performance
          
        // Invites query  
        supabase
          .from('session_invites')
          .select('id, session_id, inviter_id, invitee_id, status, created_at, updated_at')
          .eq('invitee_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(10),
          
        // Discoverable sessions
        supabase.rpc('get_discoverable_sessions_for_current_world')
      ]);

      // Handle sessions result
      if (sessionsResult.status === 'fulfilled' && !sessionsResult.value.error) {
        const sessionsData = sessionsResult.value.data || [];
        
        // Get all session IDs for participant query
        const sessionIds = sessionsData.map(s => s.id);
        
        // Load participants for all sessions in one query
        let participantsData: RawParticipantData[] = [];
        let profilesData: RawProfileData[] = [];
        
        if (sessionIds.length > 0) {
          const [participantsResult, profilesResult] = await Promise.allSettled([
            supabase
              .from('session_participants')
              .select('id, session_id, user_id, role, permissions, joined_at')
              .in('session_id', sessionIds),
            // Get profiles for all users at once - more efficient
            supabase
              .from('profiles')
              .select('id, username, display_name, is_online, avatar_url')
              .limit(100) // Reasonable limit
          ]);
          
          if (participantsResult.status === 'fulfilled') {
            participantsData = participantsResult.value.data || [];
          }
          if (profilesResult.status === 'fulfilled') {
            profilesData = profilesResult.value.data || [];
          }
        }

        // Create profiles map for fast lookups
        const profilesMap = new Map(profilesData.map(p => [p.id, p]));
        
        // Group participants by session for efficient mapping
        const participantsBySession = new Map();
        participantsData.forEach(p => {
          if (!participantsBySession.has(p.session_id)) {
            participantsBySession.set(p.session_id, []);
          }
          participantsBySession.get(p.session_id).push(p);
        });

        const sessions: MultiplayerSession[] = sessionsData.map(session => ({
          id: session.id,
          name: session.name,
          isMultiplayer: session.is_multiplayer,
          maxPlayers: session.max_players ?? 6,
          currentPlayerCount: session.current_player_count ?? 1,
          participants: (participantsBySession.get(session.id) || []).map((p: RawParticipantData): SessionParticipant => {
            const profile = profilesMap.get(p.user_id);
            return {
              id: p.id,
              sessionId: session.id,
              userId: p.user_id,
              role: p.role as 'dm' | 'player',
              permissions: (() => {
                const perms = (typeof p.permissions === 'object' && p.permissions) ? p.permissions : {};
                const canInvite = Boolean((perms).canInvite ?? (perms).can_invite);
                return { canInvite };
              })(),
              joinedAt: new Date(p.joined_at),
              profile: profile ? {
                username: profile.username,
                displayName: profile.display_name,
                isOnline: profile.is_online
              } : {
                username: `User-${p.user_id.slice(0, 8)}`,
                displayName: 'Unknown Player',
                isOnline: false
              }
            };
          }),
          messages: Array.isArray(session.messages) ? session.messages.slice(-10) : [], // Limit messages for performance
          customPrompt: session.custom_prompt,
          createdAt: new Date(session.created_at),
          updatedAt: session.updated_at ? new Date(session.updated_at) : undefined,
        }));

        debugLog(`Loaded ${sessions.length} multiplayer sessions`);
        setMultiplayerSessions(sessions);
      } else {
        debugError('Sessions query failed:', sessionsResult.status === 'rejected' ? sessionsResult.reason : 'Unknown error');
        debugError('Sessions query failed:');
        setMultiplayerSessions([]);
      }

      // Handle invites result - much faster with parallel loading
      if (invitesResult.status === 'fulfilled' && !invitesResult.value.error) {
        const invitesData = invitesResult.value.data || [];
        
        // Batch load session and inviter data for all invites
        const sessionIds = invitesData.map(i => i.session_id);
        const inviterIds = invitesData.map(i => i.inviter_id);
        
        const [sessionsBatch, invitersBatch] = await Promise.allSettled([
          sessionIds.length > 0 ? supabase
            .from('sessions')
            .select('id, name, is_multiplayer')
            .in('id', sessionIds) : Promise.resolve({ data: [] }),
          inviterIds.length > 0 ? supabase
            .from('profiles')
            .select('id, username, display_name')
            .in('id', inviterIds) : Promise.resolve({ data: [] })
        ]);
        
        const sessionsMap = new Map();
        const invitersMap = new Map();
        
        if (sessionsBatch.status === 'fulfilled' && sessionsBatch.value.data) {
          sessionsBatch.value.data.forEach(s => sessionsMap.set(s.id, s));
        }
        if (invitersBatch.status === 'fulfilled' && invitersBatch.value.data) {
          invitersBatch.value.data.forEach(u => invitersMap.set(u.id, u));
        }

        const invites: SessionInvite[] = invitesData.map(invite => {
          const session = sessionsMap.get(invite.session_id);
          const inviter = invitersMap.get(invite.inviter_id);
          
          return {
            id: invite.id,
            sessionId: invite.session_id,
            inviterId: invite.inviter_id,
            inviteeId: invite.invitee_id,
            status: invite.status as 'pending' | 'accepted' | 'declined',
            createdAt: new Date(invite.created_at),
            updatedAt: new Date(invite.updated_at),
            session: session ? {
              name: session.name,
              isMultiplayer: session.is_multiplayer
            } : undefined,
            inviter: inviter ? {
              username: inviter.username,
              displayName: inviter.display_name
            } : undefined
          };
        });

        debugLog(`Loaded ${invites.length} pending invites`);
        setSessionInvites(invites);
      } else {
        debugError('Invites query failed:', invitesResult.status === 'rejected' ? invitesResult.reason : 'Unknown error');
        debugError('Invites query failed:');
        setSessionInvites([]);
      }

      // Handle discoverable sessions result
      if (discoverableResult.status === 'fulfilled' && !discoverableResult.value.error) {
        const validSessions = discoverableResult.value.data || [];
        setDiscoverableSessions(validSessions);
        debugLog(`Loaded ${validSessions.length} discoverable sessions`);
      } else {
        debugError('Discoverable sessions query failed:', discoverableResult.status === 'rejected' ? discoverableResult.reason : 'Unknown error');
        debugError('Discoverable sessions query failed:');
        setDiscoverableSessions([]);
      }

    } catch {
      debugError('Error loading multiplayer data:');
      
      // Determine error type and provide specific feedback
      const errorMessage = error instanceof Error ? error.message : String(error);
      let description = "Could not load multiplayer session data. Please try refreshing.";
      
      if (errorMessage.includes('relation')) {
        description = "Database schema issue detected. Please contact support.";
      } else if (errorMessage.includes('permission denied') || errorMessage.includes('RLS')) {
        description = "Permission denied. Please ensure you're logged in correctly.";
      } else if (errorMessage.includes('network')) {
        description = "Network connection issue. Please check your internet connection.";
      }

      toast({
        title: "Load Error",
        description,
        variant: "destructive",
      });

      // Retry mechanism for transient errors
      if (retryCount < 2 && !errorMessage.includes('permission denied')) {
        debugLog(`Retrying in ${(retryCount + 1) * 1000}ms...`);
        setTimeout(() => loadMultiplayerData(retryCount + 1), (retryCount + 1) * 1000);
        return;
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  // Fallback strategy - load data in separate queries
  const loadMultiplayerDataFallback = useCallback(async () => {
    if (!user) return;

    debugLog('Using fallback data loading strategy');

    try {
      // Load basic sessions first
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .eq('is_multiplayer', true)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      if (!sessionsData?.length) {
        setMultiplayerSessions([]);
        setSessionInvites([]);
        return;
      }

      // Load participants for each session
      const sessionIds = sessionsData.map(s => s.id);
      const { data: participantsData, error: participantsError } = await supabase
        .from('session_participants')
        .select('id, session_id, user_id, role, permissions, joined_at')
        .in('session_id', sessionIds);

      if (participantsError) {
        debugError('Fallback participants query failed:', participantsError);
      }

      // Load profiles for participants
      const userIds = participantsData?.map(p => p.user_id) || [];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, display_name, is_online')
        .in('id', userIds);

      if (profilesError) {
        debugError('Fallback profiles query failed:', profilesError);
      }

      // Combine data
      const profilesMap = new Map(
        (profilesData || []).map(p => [p.id, p])
      );

      const sessions: MultiplayerSession[] = sessionsData.map(session => {
        const sessionParticipants: SessionParticipant[] = (participantsData || [])
          .filter(p => p.session_id === session.id)
          .map(p => {
            const profileData = profilesMap.get(p.user_id);
            return {
              id: p.id,
              sessionId: session.id,
              userId: p.user_id,
              role: p.role as 'dm' | 'player',
              permissions: (() => {
                const perms = (typeof p.permissions === 'object' && p.permissions) ? p.permissions : {};
                const canInvite = Boolean((perms as PermissionsObject).canInvite ?? (perms as PermissionsObject).can_invite);
                return { canInvite };
              })(),
              joinedAt: new Date(p.joined_at),
              profile: profileData ? {
                username: profileData.username,
                displayName: profileData.display_name,
                isOnline: profileData.is_online
              } : {
                username: `User-${p.user_id.slice(0, 8)}`,
                displayName: 'Unknown Player',
                isOnline: false
              }
            };
          });

        return {
          id: session.id,
          name: session.name,
          isMultiplayer: session.is_multiplayer,
          maxPlayers: session.max_players ?? 6,
          currentPlayerCount: session.current_player_count ?? 1,
          participants: sessionParticipants,
          messages: Array.isArray(session.messages) ? session.messages : [],
          customPrompt: session.custom_prompt,
          createdAt: new Date(session.created_at),
          updatedAt: session.updated_at ? new Date(session.updated_at) : undefined,
        };
      });

      debugLog(`Fallback strategy loaded ${sessions.length} sessions successfully`);
      setMultiplayerSessions(sessions);

      // Load invites with basic query
      const { data: invitesData } = await supabase
        .from('session_invites')
        .select('*')
        .eq('invitee_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      const invites: SessionInvite[] = (invitesData || []).map(invite => ({
        id: invite.id,
        sessionId: invite.session_id,
        inviterId: invite.inviter_id,
        inviteeId: invite.invitee_id,
        status: invite.status as 'pending' | 'accepted' | 'declined',
        createdAt: new Date(invite.created_at),
        updatedAt: new Date(invite.updated_at),
      }));

      setSessionInvites(invites);

    } catch {
      debugError('Fallback strategy also failed:');
      toast({
        title: "Critical Error",
        description: "Unable to load multiplayer data with any method. Please contact support.",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  // Create multiplayer session using new RPC function
  const createMultiplayerSession = useCallback(async (name: string, customPrompt = '', maxPlayers = 6) => {
    if (!user) return null;

    try {
      debugLog('🎮 Creating multiplayer session with RPC function:', name);
      
      // Use the new RPC function for creating multiplayer sessions
      const { data, error } = await supabase.rpc('create_multiplayer_session_fixed', {
        session_name: name,
        custom_prompt: customPrompt ?? null,
        max_players: maxPlayers
      });

      if (error) {
        debugError('🎮 RPC error creating session:');
        throw new Error("Operation failed");
      }

      if (!data?.success) {
        const errorMsg = data?.error ?? 'Failed to create session';
        debugError('🎮 Session creation failed:', errorMsg);
        throw new Error(errorMsg);
      }

      debugLog('✅ Multiplayer session created successfully:', data);

      toast({
        title: "🎉 Multiplayer Session Created!",
        description: `"${data.session_name}" is ready for ${data.max_players} adventurers!`,
      });

      // Reload multiplayer data to show the new session
      await loadMultiplayerData();
      
      // Return sessionId and trigger invite flow
      return { 
        sessionId: data.session_id, 
        shouldInvite: true,
        joinUrl: data.join_url,
        sessionName: data.session_name
      };

    } catch {
      debugError('❌ Error creating multiplayer session:');
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      toast({
        title: "Session Creation Failed",
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    }
  }, [user, toast, loadMultiplayerData]);

  // Send session invite
  const sendSessionInvite = useCallback(async (sessionId: string, friendId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('session_invites')
        .insert({
          session_id: sessionId,
          inviter_id: user.id,
          invitee_id: friendId,
          status: 'pending'
        });

      if (error) throw new Error("Operation failed");

      toast({
        title: "Invite Sent",
        description: "Your friend has been invited to join the adventure!",
      });

      return true;

    } catch {
      debugError('Error sending session invite:');
      toast({
        title: "Invite Failed",
        description: "Could not send the invitation. They may already be invited.",
        variant: "destructive",
      });
      return false;
    }
  }, [user, toast]);

  // Accept session invite using server-side RPC
  const acceptSessionInvite = useCallback(async (inviteId: string) => {
    if (!user) return false;

    try {
      debugLog('Accepting session invite:', inviteId);
      
      const { data, error } = await supabase.rpc('accept_session_invite', {
        invite_id: inviteId
      });

      if (error) throw new Error("Operation failed");

      const result = data as { success: boolean; message?: string; error?: string; session?: MultiplayerSession };

      if (result?.success) {
        toast({
          title: "Invite Accepted!",
          description: result.message ?? "Successfully joined the multiplayer session!",
        });

        // Refresh data to show the new session
        await loadMultiplayerData();
        return result.session;
      } else {
        toast({
          title: "Accept Failed",
          description: result?.error ?? "Could not accept the invitation.",
          variant: "destructive",
        });
        return false;
      }

    } catch {
      debugError('Error accepting session invite:');
      toast({
        title: "Join Failed",
        description: "Could not join the session. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  }, [user, toast, loadMultiplayerData]);

  // Decline session invite
  const declineSessionInvite = useCallback(async (inviteId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('session_invites')
        .update({ status: 'declined' })
        .eq('id', inviteId);

      if (error) throw new Error("Operation failed");

      toast({
        title: "Invitation Declined",
        description: "You've declined the adventure invitation.",
      });

      await loadMultiplayerData();
      return true;

    } catch {
      debugError('Error declining session invite:');
      toast({
        title: "Error",
        description: "Could not decline the invitation. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  }, [user, toast, loadMultiplayerData]);

  // Leave multiplayer session
  const leaveSession = useCallback(async (sessionId: string) => {
    if (!user) return false;

    try {
      // Remove participant
      const { error: removeError } = await supabase
        .from('session_participants')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', user.id);

      if (removeError) throw removeError;

      // Update session player count
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('current_player_count')
        .eq('id', sessionId)
        .single();
      
      if (sessionData && sessionData.current_player_count > 1) {
        await supabase
          .from('sessions')
          .update({ current_player_count: sessionData.current_player_count - 1 })
          .eq('id', sessionId);
      }

      toast({
        title: "Left Session",
        description: "You've left the adventure. You can rejoin if invited again.",
      });

      await loadMultiplayerData();
      return true;

    } catch {
      debugError('Error leaving session:');
      toast({
        title: "Leave Failed",
        description: "Could not leave the session. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  }, [user, toast, loadMultiplayerData]);

  // Set up real-time subscriptions with enhanced error handling
  useEffect(() => {
    if (!user) return;

    debugLog('Setting up real-time subscriptions for multiplayer sessions');

    const inviteChannel = supabase
      .channel('session-invites')
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'session_invites',
          filter: `invitee_id=eq.${user.id}`
        },
        (payload) => {
          debugLog('Real-time invite update:', payload);
          loadMultiplayerData();
        }
      )
      .subscribe((status) => {
        debugLog('Invite channel status:', status);
      });

    const participantChannel = supabase
      .channel('session-participants')
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'session_participants'
        },
        (payload) => {
          debugLog('Real-time participant update:', payload);
          loadMultiplayerData();
        }
      )
      .subscribe((status) => {
        debugLog('Participant channel status:', status);
      });

    const sessionChannel = supabase
      .channel('multiplayer-sessions')
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'sessions',
          filter: 'is_multiplayer=eq.true'
        },
        (payload) => {
          debugLog('Real-time session update:', payload);
          loadMultiplayerData();
        }
      )
      .subscribe((status) => {
        debugLog('Session channel status:', status);
      });

    return () => {
      debugLog('Cleaning up real-time subscriptions');
      supabase.removeChannel(inviteChannel);
      supabase.removeChannel(participantChannel);
      supabase.removeChannel(sessionChannel);
    };
  }, [user, loadMultiplayerData]);

  // Set up real-time subscriptions for multiplayer updates
  useMultiplayerRealtime(loadMultiplayerData);

  // Load data on mount and periodically refresh
  useEffect(() => {
    loadMultiplayerData();
    
    // Refresh data every 30 seconds to ensure sync
    const interval = setInterval(() => {
      loadMultiplayerData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [loadMultiplayerData]);

  // Enhanced session data with online presence
  const enhancedSessions = useMemo(() => {
    return multiplayerSessions.map(session => ({
      ...session,
      participants: session.participants.map(participant => ({
        ...participant,
        profile: {
          ...participant.profile,
          isOnline: onlineUsers.some(u => u.userId === participant.userId)
        }
      }))
    }));
  }, [multiplayerSessions, onlineUsers]);

  return {
    multiplayerSessions: enhancedSessions,
    sessionInvites,
    discoverableSessions,
    isLoading,
    createMultiplayerSession,
    sendSessionInvite,
    acceptSessionInvite,
    declineSessionInvite,
    leaveSession,
    refreshData: loadMultiplayerData,
    onlineUsers,
    getOnlineParticipants,
    areConnectionsHealthy,
  };
};
