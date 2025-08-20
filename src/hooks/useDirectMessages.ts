import { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { debugLog, debugError } from '@/lib/debug';

export interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sender?: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
    isOnline?: boolean;
  };
  recipient?: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
    isOnline?: boolean;
  };
}

export interface MessageConversation {
  otherUserId: string;
  otherUser: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
    isOnline?: boolean;
  };
  lastMessage: DirectMessage;
  unreadCount: number;
  messages: DirectMessage[];
}

export const useDirectMessages = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [conversations, setConversations] = useState<MessageConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<MessageConversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Load all conversations for the current user
  const loadConversations = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      debugLog('Loading conversations for user:', user.id);

      // Get all messages involving the current user (without joins to avoid FK issues)
      const { data: messagesData, error: messagesError } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      // Get unique user IDs from messages
      const userIds = Array.from(new Set([
        ...(messagesData || []).map(msg => msg.sender_id),
        ...(messagesData || []).map(msg => msg.recipient_id)
      ]));

      // Fetch all relevant profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_online')
        .in('id', userIds);

      if (profilesError) {
        debugError('Error loading profiles:', profilesError);
        // Continue without profile data
      }

      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));

      // Group messages by conversation (other user)
      const conversationMap = new Map<string, MessageConversation>();
      
      for (const message of messagesData || []) {
        const otherUserId = message.sender_id === user.id ? message.recipient_id : message.sender_id;
        const senderProfile = profilesMap.get(message.sender_id);
        const recipientProfile = profilesMap.get(message.recipient_id);
        const otherUserProfile = profilesMap.get(otherUserId);
        
        const formattedMessage: DirectMessage = {
          id: message.id,
          senderId: message.sender_id,
          recipientId: message.recipient_id,
          content: message.content,
          readAt: message.read_at ? new Date(message.read_at) : null,
          createdAt: new Date(message.created_at),
          updatedAt: new Date(message.updated_at),
          sender: senderProfile ? {
            id: senderProfile.id,
            username: senderProfile.username,
            displayName: senderProfile.display_name,
            avatarUrl: senderProfile.avatar_url,
            isOnline: senderProfile.is_online
          } : {
            id: message.sender_id,
            username: `User-${message.sender_id.slice(0, 8)}`,
            displayName: 'Unknown User'
          },
          recipient: recipientProfile ? {
            id: recipientProfile.id,
            username: recipientProfile.username,
            displayName: recipientProfile.display_name,
            avatarUrl: recipientProfile.avatar_url,
            isOnline: recipientProfile.is_online
          } : {
            id: message.recipient_id,
            username: `User-${message.recipient_id.slice(0, 8)}`,
            displayName: 'Unknown User'
          }
        };

        if (!conversationMap.has(otherUserId)) {
          conversationMap.set(otherUserId, {
            otherUserId,
            otherUser: otherUserProfile ? {
              id: otherUserProfile.id,
              username: otherUserProfile.username,
              displayName: otherUserProfile.display_name,
              avatarUrl: otherUserProfile.avatar_url,
              isOnline: otherUserProfile.is_online
            } : {
              id: otherUserId,
              username: `User-${otherUserId.slice(0, 8)}`,
              displayName: 'Unknown User',
              isOnline: false
            },
            lastMessage: formattedMessage,
            unreadCount: 0,
            messages: []
          });
        }

        const conversation = conversationMap.get(otherUserId);
        conversation.messages.push(formattedMessage);
        
        // Count unread messages (messages sent to current user that aren't read)
        if (message.recipient_id === user.id && !message.read_at) {
          conversation.unreadCount++;
        }

        // Update last message if this message is newer
        if (formattedMessage.createdAt > conversation.lastMessage.createdAt) {
          conversation.lastMessage = formattedMessage;
        }
      }

      // Sort messages within each conversation by timestamp
      conversationMap.forEach(conversation => {
        conversation.messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      });

      // Convert to array and sort by last message timestamp
      const sortedConversations = Array.from(conversationMap.values())
        .sort((a, b) => b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime());

      debugLog(`Loaded ${sortedConversations.length} conversations`);
      setConversations(sortedConversations);

    } catch (error) {
      debugError('Error loading conversations:', error);
      toast({
        title: "Error Loading Messages",
        description: "Could not load your conversations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  // Send a message
  const sendMessage = useCallback(async (recipientId: string, content: string) => {
    if (!user || !content.trim()) return false;

    setIsSending(true);
    try {
      debugLog('Sending message to:', recipientId);

      const { error } = await supabase
        .from('direct_messages')
        .insert({
          sender_id: user.id,
          recipient_id: recipientId,
          content: content.trim()
        });

      if (error) throw error;

      // Refresh conversations to show the new message
      await loadConversations();
      
      debugLog('Message sent successfully');
      return true;

    } catch (error) {
      debugError('Error sending message:', error);
      toast({
        title: "Send Failed",
        description: "Could not send your message. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSending(false);
    }
  }, [user, toast, loadConversations]);

  // Mark messages as read
  const markMessagesAsRead = useCallback(async (otherUserId: string) => {
    if (!user) return;

    try {
      debugLog('Marking messages as read from:', otherUserId);

      const { error } = await supabase
        .from('direct_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('sender_id', otherUserId)
        .eq('recipient_id', user.id)
        .is('read_at', null);

      if (error) throw error;

      // Update local state
      setConversations(prev => prev.map(conv => 
        conv.otherUserId === otherUserId 
          ? { 
              ...conv, 
              unreadCount: 0,
              messages: conv.messages.map(msg => 
                msg.senderId === otherUserId && !msg.readAt 
                  ? { ...msg, readAt: new Date() }
                  : msg
              )
            }
          : conv
      ));

      debugLog('Messages marked as read');

    } catch (error) {
      debugError('Error marking messages as read:', error);
    }
  }, [user]);

  // Start a conversation with a user
  const startConversation = useCallback(async (userId: string) => {
    if (!user) return null;

    try {
      // Check if conversation already exists
      const existing = conversations.find(conv => conv.otherUserId === userId);
      if (existing) {
        setSelectedConversation(existing);
        return existing;
      }

      // Get user profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_online')
        .eq('id', userId)
        .single();

      if (error) throw error;

      // Create new conversation object
      const newConversation: MessageConversation = {
        otherUserId: userId,
        otherUser: {
          id: profile.id,
          username: profile.username,
          displayName: profile.display_name,
          avatarUrl: profile.avatar_url,
          isOnline: profile.is_online
        },
        lastMessage: {
          id: '',
          senderId: '',
          recipientId: '',
          content: '',
          readAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        unreadCount: 0,
        messages: []
      };

      setSelectedConversation(newConversation);
      return newConversation;

    } catch (error) {
      debugError('Error starting conversation:', error);
      toast({
        title: "Error",
        description: "Could not start conversation with this user.",
        variant: "destructive",
      });
      return null;
    }
  }, [user, conversations, toast]);

  // Set up real-time subscriptions for new messages
  useEffect(() => {
    if (!user) return;

    debugLog('Setting up message real-time subscriptions');

    const channel = supabase
      .channel('direct_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `or(sender_id.eq.${user.id},recipient_id.eq.${user.id})`
        },
        () => {
          debugLog('New message received, reloading conversations');
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_messages',
          filter: `recipient_id.eq.${user.id}`
        },
        () => {
          debugLog('Message updated (likely read status), reloading conversations');
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      debugLog('Cleaning up message subscriptions');
      supabase.removeChannel(channel);
    };
  }, [user, loadConversations]);

  // Load conversations on mount
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user, loadConversations]);

  return {
    conversations,
    selectedConversation,
    setSelectedConversation,
    isLoading,
    isSending,
    sendMessage,
    markMessagesAsRead,
    startConversation,
    loadConversations
  };
};