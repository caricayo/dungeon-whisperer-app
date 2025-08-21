import { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { debugLog, debugError } from '@/lib/debug';
import { useRealtimeManager } from './useRealtimeManager';

export interface SimpleSession {
  id: string;
  name: string;
  created_at: string;
  creator_id: string;
  is_multiplayer: boolean;
  participants?: {
    user_id: string;
    role: 'dm' | 'player';
    profile?: {
      username: string;
      display_name?: string;
    };
  }[];
}

export const useSimpleMultiplayer = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SimpleSession[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Simple realtime subscription for session updates
  useRealtimeManager([
    {
      table: 'game_sessions',
      event: '*',
      callback: () => {
        loadSessions();
      }
    }
  ]);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('game_sessions')
        .select(`
          *,
          session_participants!left(
            user_id,
            role,
            profiles!inner(username, display_name)
          )
        `)
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      debugError('Error loading sessions:', error);
      toast({
        title: "Error loading sessions",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const createSession = useCallback(async (name: string, isMultiplayer = false) => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase
        .from('game_sessions')
        .insert([{
          name,
          creator_id: user.id,
          is_multiplayer: isMultiplayer,
          settings: {}
        }])
        .select()
        .single();

      if (error) throw error;
      
      toast({
        title: "Session created",
        description: `${name} is ready to play!`,
      });
      
      await loadSessions();
      return data;
    } catch (error) {
      debugError('Error creating session:', error);
      toast({
        title: "Failed to create session",
        description: "Please try again",
        variant: "destructive",
      });
      return null;
    }
  }, [user, toast, loadSessions]);

  const joinSession = useCallback(async (sessionId: string) => {
    if (!user) return false;
    
    try {
      const { error } = await supabase
        .from('session_participants')
        .insert([{
          session_id: sessionId,
          user_id: user.id,
          role: 'player'
        }]);

      if (error) throw error;
      
      toast({
        title: "Joined session",
        description: "You can now participate in this session",
      });
      
      return true;
    } catch (error) {
      debugError('Error joining session:', error);
      toast({
        title: "Failed to join session",
        description: "Please try again",
        variant: "destructive",
      });
      return false;
    }
  }, [user, toast]);

  const deleteSession = useCallback(async (sessionId: string) => {
    if (!user) return false;
    
    try {
      const { error } = await supabase
        .from('game_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('creator_id', user.id);

      if (error) throw error;
      
      toast({
        title: "Session deleted",
        description: "The session has been removed",
      });
      
      await loadSessions();
      return true;
    } catch (error) {
      debugError('Error deleting session:', error);
      toast({
        title: "Failed to delete session",
        description: "Please try again",
        variant: "destructive",
      });
      return false;
    }
  }, [user, toast, loadSessions]);

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user, loadSessions]);

  return {
    sessions,
    loading,
    createSession,
    joinSession,
    deleteSession,
    refreshSessions: loadSessions
  };
};