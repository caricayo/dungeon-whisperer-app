import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { debugLog, debugError } from '@/lib/debug';
import { useToast } from '@/hooks/use-toast';

export const useRealtimeChat = (sessionId?: string, onMessageReceived?: (message: any) => void) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const channelRef = useRef<any>(null);

  const setupRealtimeChat = useCallback(() => {
    if (!user || !sessionId) return;

    debugLog('🔄 Setting up real-time chat for session:', sessionId);

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create new channel with session-specific name
    const channel = supabase
      .channel(`session:${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${sessionId}`
      }, (payload) => {
        debugLog('🔄 Session messages updated:', payload);
        
        if (payload.new?.messages && onMessageReceived) {
          const messages = payload.new.messages as any[];
          const lastMessage = messages[messages.length - 1];
          
          if (lastMessage) {
            onMessageReceived(lastMessage);
          }
        }
      })
      .subscribe((status) => {
        debugLog('🔄 Chat real-time subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          debugLog('🔄 Real-time chat connected for session:', sessionId);
        } else if (status === 'CHANNEL_ERROR') {
          debugError('🔄 Real-time chat error for session:', sessionId);
          toast({
            title: "Real-time Connection Issue",
            description: "Chat messages might not sync in real-time. Try refreshing.",
            variant: "destructive"
          });
        }
      });

    channelRef.current = channel;
    return channel;
  }, [user, sessionId, onMessageReceived, toast]);

  // Set up real-time chat when session changes
  useEffect(() => {
    const channel = setupRealtimeChat();
    
    return () => {
      if (channel) {
        debugLog('🔄 Cleaning up real-time chat for session:', sessionId);
        supabase.removeChannel(channel);
        channelRef.current = null;
      }
    };
  }, [setupRealtimeChat]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  return {
    isConnected: channelRef.current !== null
  };
};