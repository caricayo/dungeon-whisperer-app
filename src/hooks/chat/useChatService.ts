/**
 * @fileoverview Enterprise chat service hook with comprehensive state management
 * @enterprise Handles all chat operations with error recovery and performance optimization
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { ChatService } from '@/domains/chat/services/ChatService';
import { Message, Session } from '@/domains/chat/types';
import { EnterpriseError } from '@/lib/enterprise/ErrorHandler';
import { Logger } from '@/lib/enterprise/Logger';
import { MetricsCollector } from '@/lib/enterprise/MetricsCollector';
import { useAuth } from '@/contexts/AuthContext';

interface ChatServiceState {
  messages: Message[];
  isLoading: boolean;
  error: EnterpriseError | null;
  isGeneratingImage: boolean;
  isGeneratingAudio: boolean;
  isGeneratingVideo: boolean;
}

/**
 * Enterprise chat service hook with comprehensive error handling and optimization
 * @enterprise Provides type-safe chat operations with monitoring and recovery
 */
export function useChatService(session: Session | null) {
  const { user } = useAuth();
  const logger = Logger.getInstance('useChatService');
  const metrics = MetricsCollector.getInstance();
  const chatServiceRef = useRef<ChatService>(new ChatService());
  
  const [state, setState] = useState<ChatServiceState>({
    messages: session?.messages || [],
    isLoading: false,
    error: null,
    isGeneratingImage: false,
    isGeneratingAudio: false,
    isGeneratingVideo: false
  });

  // Sync messages when session changes
  useEffect(() => {
    setState(prev => ({
      ...prev,
      messages: session?.messages || [],
      error: null
    }));
  }, [session?.id]);

  // Optimized send message function
  const sendMessage = useCallback(async (content: string): Promise<void> => {
    if (!session || !user) {
      throw new Error('Session and authentication required');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await chatServiceRef.current.sendMessage(
        content,
        session.id,
        user.id,
        {
          customPrompt: session.configuration.customPrompt,
          model: session.configuration.model
        }
      );

      // Update local state with new messages
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, result.userMessage, result.assistantMessage],
        isLoading: false
      }));

      // Record successful interaction
      metrics.recordUserEngagement(user.id, 'message_exchanged', {
        sessionId: session.id,
        messageLength: content.length.toString()
      });

    } catch (error) {
      logger.error('Send message failed', { 
        sessionId: session.id, 
        userId: user.id,
        error 
      });

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as EnterpriseError
      }));

      throw error;
    }
  }, [session, user, logger, metrics]);

  // Generate image for message
  const generateImage = useCallback(async (messageId: string): Promise<void> => {
    const message = state.messages.find(m => m.id === messageId);
    if (!message) return;

    setState(prev => ({ ...prev, isGeneratingImage: true }));

    try {
      logger.info('Generating image', { messageId, content: message.content.substring(0, 100) });
      
      // Call the actual image generation service
      const imageUrl = await chatServiceRef.current.generateImage(
        message.content,
        messageId
      );
      
      // Update message with real image URL
      setState(prev => ({
        ...prev,
        messages: prev.messages.map(m => 
          m.id === messageId 
            ? { ...m, attachments: { ...m.attachments, imageUrl } }
            : m
        ),
        isGeneratingImage: false
      }));

      metrics.recordUserEngagement(user?.id || 'anonymous', 'image_generated', {
        messageId
      });

    } catch (error) {
      logger.error('Image generation failed', { messageId, error });
      setState(prev => ({ ...prev, isGeneratingImage: false }));
      throw error;
    }
  }, [state.messages, user?.id, logger, metrics]);

  // Generate audio for message
  const generateAudio = useCallback(async (messageId: string): Promise<void> => {
    const message = state.messages.find(m => m.id === messageId);
    if (!message) return;

    setState(prev => ({ ...prev, isGeneratingAudio: true }));

    try {
      const audioUrl = await chatServiceRef.current.generateAudio(
        message.content,
        messageId,
        { provider: 'elevenlabs' }
      );

      // Update message with audio URL
      setState(prev => ({
        ...prev,
        messages: prev.messages.map(m => 
          m.id === messageId 
            ? { ...m, attachments: { ...m.attachments, audioUrl } }
            : m
        ),
        isGeneratingAudio: false
      }));

      metrics.recordUserEngagement(user?.id || 'anonymous', 'audio_generated', {
        messageId,
        textLength: message.content.length.toString()
      });

    } catch (error) {
      logger.error('Audio generation failed', { messageId, error });
      setState(prev => ({ ...prev, isGeneratingAudio: false }));
      throw error;
    }
  }, [state.messages, user?.id, logger, metrics]);

  // Generate video for message
  const generateVideo = useCallback(async (messageId: string): Promise<void> => {
    const message = state.messages.find(m => m.id === messageId);
    if (!message) return;

    setState(prev => ({ ...prev, isGeneratingVideo: true }));

    try {
      logger.info('Generating video', { messageId, content: message.content.substring(0, 100) });
      
      // Call the actual video generation service
      const videoUrl = await chatServiceRef.current.generateVideo(
        message.content,
        messageId,
        { provider: 'runway' }
      );
      
      // Update message with real video URL
      setState(prev => ({
        ...prev,
        messages: prev.messages.map(m => 
          m.id === messageId 
            ? { ...m, attachments: { ...m.attachments, videoUrl } }
            : m
        ),
        isGeneratingVideo: false
      }));

      metrics.recordUserEngagement(user?.id || 'anonymous', 'video_generated', {
        messageId,
        textLength: message.content.length.toString()
      });

    } catch (error) {
      logger.error('Video generation failed', { messageId, error });
      setState(prev => ({ ...prev, isGeneratingVideo: false }));
      throw error;
    }
  }, [state.messages, user?.id, logger, metrics]);

  // Clear error state
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Retry last failed operation
  const retryLastOperation = useCallback(async () => {
    if (!state.error?.retryable) return;

    logger.info('Retrying last operation', { 
      errorId: state.error.id,
      operation: state.error.context.operation 
    });

    setState(prev => ({ ...prev, error: null }));

    // Implementation would retry the specific operation
    // For now, just clear the error
  }, [state.error, logger]);

  return {
    messages: state.messages,
    isLoading: state.isLoading,
    error: state.error,
    isGeneratingImage: state.isGeneratingImage,
    isGeneratingAudio: state.isGeneratingAudio,
    isGeneratingVideo: state.isGeneratingVideo,
    sendMessage,
    generateImage,
    generateAudio,
    generateVideo,
    clearError,
    retryLastOperation
  };
}