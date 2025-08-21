import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { debugLog, debugError } from '@/lib/debug';

interface ReadReceipt {
  message_id: string;
  user_id: string;
  username: string;
  display_name?: string;
  read_at: Date;
}

export const useReadReceipts = (sessionId: string | null) => {
  const { user } = useAuth();
  const [readReceipts, setReadReceipts] = useState<ReadReceipt[]>([]);

  // Mark message as read
  const markMessageAsRead = useCallback(async (messageId: string) => {
    if (!sessionId || !user) return;

    try {
      // Broadcast read receipt
      const channel = supabase.channel(`receipts:${sessionId}`);
      
      const receiptPayload = {
        message_id: messageId,
        user_id: user.id,
        sessionId,
        read_at: new Date().toISOString()
      };

      channel.send({
        type: 'broadcast',
        event: 'message_read',
        payload: receiptPayload
      });

      debugLog('📖 Marked message as read:', messageId);

    } catch {
      debugError('📖 Error marking message as read:');
    }
  }, [sessionId, user]);

  // Bulk mark messages as read (for scroll-based reading)
  const markMessagesAsRead = useCallback(async (messageIds: string[]) => {
    if (!sessionId || !user || messageIds.length === 0) return;

    try {
      const channel = supabase.channel(`receipts:${sessionId}`);
      const timestamp = new Date().toISOString();

      // Send bulk read receipts
      for (const messageId of messageIds) {
        channel.send({
          type: 'broadcast',
          event: 'message_read',
          payload: {
            message_id: messageId,
            user_id: user.id,
            sessionId,
            read_at: timestamp
          }
        });
      }

      debugLog('📖 Bulk marked messages as read:', messageIds.length);

    } catch {
      debugError('📖 Error bulk marking messages as read:');
    }
  }, [sessionId, user]);

  // Get read status for a message
  const getMessageReadStatus = useCallback((messageId: string) => {
    return readReceipts
      .filter(receipt => receipt.message_id === messageId)
      .sort((a, b) => b.read_at.getTime() - a.read_at.getTime());
  }, [readReceipts]);

  // Check if message has been read by specific user
  const isMessageReadBy = useCallback((messageId: string, userId: string) => {
    return readReceipts.some(receipt => 
      receipt.message_id === messageId && receipt.user_id === userId
    );
  }, [readReceipts]);

  // Set up read receipts subscription
  useEffect(() => {
    if (!sessionId || !user) {
      setReadReceipts([]);
      return;
    }

    const channel = supabase
      .channel(`receipts:${sessionId}`)
      .on('broadcast', { event: 'message_read' }, (payload) => {
        const { message_id, user_id, read_at } = payload.payload;
        
        debugLog('📖 Received read receipt:', { message_id, user_id });
        
        // Get user profile for display
        supabase
          .from('profiles')
          .select('username, display_name')
          .eq('id', user_id)
          .single()
          .then(({ data }) => {
            if (data) {
              setReadReceipts(prev => {
                // Remove existing receipt from same user for same message
                const filtered = prev.filter(r => 
                  !(r.message_id === message_id && r.user_id === user_id)
                );
                
                // Add new receipt
                return [...filtered, {
                  message_id,
                  user_id,
                  username: data.username,
                  display_name: data.display_name,
                  read_at: new Date(read_at)
                }];
              });
            }
          });
      })
      .subscribe((status) => {
        debugLog('📖 Read receipts channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, user]);

  return {
    readReceipts,
    markMessageAsRead,
    markMessagesAsRead,
    getMessageReadStatus,
    isMessageReadBy
  };
};
