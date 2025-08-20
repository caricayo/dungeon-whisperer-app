import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { debugLog, debugError } from '@/lib/debug';

interface TypingUser {
  user_id: string;
  username: string;
  display_name?: string;
  timestamp: Date;
}

export const useTypingIndicators = (sessionId: string | null) => {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const channelRef = useRef<any>();

  // Start typing indicator
  const startTyping = useCallback(() => {
    if (!sessionId || !user) return;

    const channel = supabase.channel(`typing:${sessionId}`);
    
    // Broadcast typing start
    channel.send({
      type: 'broadcast',
      event: 'typing_start',
      payload: {
        user_id: user.id,
        sessionId,
        timestamp: new Date().toISOString()
      }
    });

    debugLog('📝 Started typing indicator for session:', sessionId);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Auto-stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [sessionId, user]);

  // Stop typing indicator
  const stopTyping = useCallback(() => {
    if (!sessionId || !user) return;

    const channel = supabase.channel(`typing:${sessionId}`);
    
    // Broadcast typing stop
    channel.send({
      type: 'broadcast',
      event: 'typing_stop',
      payload: {
        user_id: user.id,
        sessionId,
        timestamp: new Date().toISOString()
      }
    });

    debugLog('📝 Stopped typing indicator for session:', sessionId);

    // Clear timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = undefined;
    }
  }, [sessionId, user]);

  // Set up typing indicators subscription
  useEffect(() => {
    if (!sessionId || !user) {
      setTypingUsers([]);
      return;
    }

    const channel = supabase
      .channel(`typing:${sessionId}`)
      .on('broadcast', { event: 'typing_start' }, (payload) => {
        const { user_id, timestamp } = payload.payload;
        
        // Don't show own typing
        if (user_id === user.id) return;
        
        debugLog('📝 User started typing:', user_id);
        
        // Get user profile for display
        supabase
          .from('profiles')
          .select('username, display_name')
          .eq('id', user_id)
          .single()
          .then(({ data }) => {
            if (data) {
              setTypingUsers(prev => {
                // Remove existing entry for this user
                const filtered = prev.filter(u => u.user_id !== user_id);
                // Add new entry
                return [...filtered, {
                  user_id,
                  username: data.username,
                  display_name: data.display_name,
                  timestamp: new Date(timestamp)
                }];
              });
            }
          });
      })
      .on('broadcast', { event: 'typing_stop' }, (payload) => {
        const { user_id } = payload.payload;
        
        debugLog('📝 User stopped typing:', user_id);
        
        setTypingUsers(prev => prev.filter(u => u.user_id !== user_id));
      })
      .subscribe((status) => {
        debugLog('📝 Typing channel status:', status);
      });

    channelRef.current = channel;

    // Cleanup old typing indicators every 10 seconds
    const cleanupInterval = setInterval(() => {
      const now = new Date();
      setTypingUsers(prev => prev.filter(u => 
        now.getTime() - u.timestamp.getTime() < 10000 // 10 seconds
      ));
    }, 10000);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      clearInterval(cleanupInterval);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [sessionId, user]);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      stopTyping();
    };
  }, [stopTyping]);

  return {
    typingUsers,
    startTyping,
    stopTyping
  };
};