/**
 * @fileoverview Enterprise chat container with performance optimizations and accessibility
 * @enterprise Main chat container implementing domain-driven design with proper separation of concerns
 */

import React, { memo, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { ChatSidebar } from './ChatSidebar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorHandler, parseError } from '@/components/ErrorHandler';
import { Logger } from '@/lib/enterprise/Logger';
import { MetricsCollector } from '@/lib/enterprise/MetricsCollector';
import { useChatService } from '@/hooks/chat/useChatService';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { Message, Session } from '@/domains/chat/types';
import { CoopDecisionBar } from '@/components/chat/CoopDecisionBar';

interface ChatContainerProps {
  session: Session | null;
  onSessionChange: (session: Session | null) => void;
  className?: string;
}

/**
 * Enterprise chat container with comprehensive performance monitoring
 * @enterprise Implements virtualization, memoization, and accessibility best practices
 */
export const ChatContainer = memo<ChatContainerProps>(({ 
  session, 
  onSessionChange, 
  className = ''
}) => {
  const logger = Logger.getInstance('ChatContainer');
  const metrics = MetricsCollector.getInstance();
  const containerRef = useRef<HTMLDivElement>(null);
  const { monitor } = usePerformanceMonitor('ChatContainer');
  
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    generateImage,
    generateAudio,
    generateVideo,
    clearError
  } = useChatService(session);

  // Virtualization for large message lists (enterprise performance optimization)
  const messagesVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: useCallback(() => 120, []), // Estimated message height
    overscan: 5 // Render 5 extra items for smooth scrolling
  });

  // Memoized message processing for performance
  const processedMessages = useMemo(() => {
    return monitor('messageProcessing', () => {
      return messages.map(message => ({
        ...message,
        // Add any computed properties here
        isToday: new Date(message.timestamp).toDateString() === new Date().toDateString(),
        formattedTime: new Date(message.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
      }));
    });
  }, [messages, monitor]);

  // Optimized message sending with analytics
  const handleSendMessage = useCallback(async (content: string) => {
    if (!session) return;

    const startTime = Date.now();
    
    try {
      logger.info('User sending message', {
        sessionId: session.id,
        messageLength: content.length
      });

      await sendMessage(content);

      // Record user engagement metrics
      metrics.recordUserEngagement(session.id, 'message_sent', {
        messageLength: content.length.toString(),
        sessionMessageCount: messages.length.toString()
      });

      metrics.recordPerformance('sendMessage', Date.now() - startTime, true);

    } catch (error) {
      logger.error('Failed to send message', {
        sessionId: session.id,
        error
      });
      
      metrics.recordPerformance('sendMessage', Date.now() - startTime, false);
    }
  }, [session, sendMessage, messages.length, logger, metrics]);

  // Auto-scroll to bottom when new messages arrive (with performance optimization)
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, []);

  useEffect(() => {
    // Debounced scroll to prevent performance issues
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [messages.length, scrollToBottom]);

  // Keyboard navigation for accessibility
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'k':
            event.preventDefault();
            // Focus search/command palette
            break;
          case 'n':
            event.preventDefault();
            // New session shortcut
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ARIA live region for screen readers
  const liveRegionContent = useMemo(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'assistant') {
      return `Assistant responded: ${lastMessage.content.substring(0, 100)}...`;
    }
    return '';
  }, [messages]);

  return (
    <ErrorBoundary>
      <div
        className={`flex h-full bg-background ${className}`}
        ref={containerRef}
        role="application"
        aria-label="D&D Chat Assistant"
      >
        {/* ARIA live region for screen readers */}
        <div
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {liveRegionContent}
        </div>

        {/* Sidebar */}
        <ChatSidebar
          session={session}
          onSessionChange={onSessionChange}
          className="hidden border-r border-border lg:flex lg:w-80"
        />

        {/* Main Chat Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <ChatHeader
            session={session}
            onSessionChange={onSessionChange}
            className="border-b border-border bg-card/50 backdrop-blur-sm"
          />

          {/* Messages Area with Virtualization */}
          <div 
            className="relative flex-1 overflow-hidden"
            style={{ contain: 'layout style paint' }} // Performance optimization
          >
            <AnimatePresence mode="popLayout">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="m-4"
                >
                  <ErrorHandler
                    error={parseError(error, 'D&D Chat')}
                    onRetry={() => {
                      clearError();
                      // Could add retry logic here if needed
                    }}
                    onDismiss={clearError}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {session ? (
              <MessageList
                messages={processedMessages}
                virtualizer={messagesVirtualizer}
                isLoading={isLoading}
                onGenerateImage={generateImage}
                onGenerateAudio={generateAudio}
                onGenerateVideo={generateVideo}
                className="h-full"
              />
            ) : (
              <div 
                className="flex h-full items-center justify-center text-muted-foreground"
                role="status"
                aria-label="No session selected"
              >
                <div className="text-center">
                  <h2 className="mb-2 text-xl font-semibold">Welcome to D&D Assistant</h2>
                  <p>Select a session from the sidebar or create a new one to get started.</p>
                </div>
              </div>
            )}
          </div>

          {/* Cooperative Decision Bar for Multiplayer */}
          {session?.metadata?.isMultiplayer && (
            <CoopDecisionBar sessionId={session.id || ''} onSendCombined={handleSendMessage} />
          )}

          {/* Input Area */}
          {session && (
            <ChatInput
              onSendMessage={handleSendMessage}
              disabled={isLoading}
              placeholder={session?.metadata?.isMultiplayer ? 'Chat or discuss while planning your turn…' : 'Describe your adventure...'}
              className="border-t border-border bg-card/30 backdrop-blur-sm"
            />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
});

ChatContainer.displayName = 'ChatContainer';