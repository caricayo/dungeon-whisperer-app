/**
 * @fileoverview Enterprise message list with virtualization and accessibility
 * @enterprise High-performance message rendering with virtual scrolling and comprehensive a11y
 */

import React, { memo, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Virtualizer } from '@tanstack/react-virtual';
import { MessageBubble } from './MessageBubble';
import { LoadingIndicator } from './LoadingIndicator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Logger } from '@/lib/enterprise/Logger';
import { Message } from '@/domains/chat/types';

interface MessageListProps {
  messages: (Message & { 
    isToday: boolean; 
    formattedTime: string; 
  })[];
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  isLoading: boolean;
  onGenerateImage?: (messageId: string) => Promise<void>;
  onGenerateAudio?: (messageId: string) => Promise<void>;
  onGenerateVideo?: (messageId: string) => Promise<void>;
  className?: string;
}

/**
 * Enterprise message list with virtual scrolling for performance
 * @enterprise Handles thousands of messages efficiently with accessibility features
 */
export const MessageList = memo<MessageListProps>(({
  messages,
  virtualizer,
  isLoading,
  onGenerateImage,
  onGenerateAudio,
  onGenerateVideo,
  className = ''
}) => {
  const logger = Logger.getInstance('MessageList');

  // Memoized message grouping for date separators
  const _messageGroups = useMemo(() => {
    const groups: { date: string; messages: typeof messages }[] = [];
    let currentGroup: { date: string; messages: typeof messages } | null = null;

    messages.forEach(message => {
      const messageDate = new Date(message.timestamp).toDateString();
      
      if (!currentGroup || currentGroup.date !== messageDate) {
        currentGroup = { date: messageDate, messages: [] };
        groups.push(currentGroup);
      }
      
      currentGroup.messages.push(message);
    });

    return groups;
  }, [messages]);

  // Optimized image generation handler
  const handleGenerateImage = useCallback(async (messageId: string) => {
    if (!onGenerateImage) return;
    
    try {
      logger.info('Generating image for message', { messageId });
      await onGenerateImage(messageId);
    } catch {
      logger.error('Image generation failed', {messageId});
    }
  }, [onGenerateImage, logger]);

  // Optimized audio generation handler
  const handleGenerateAudio = useCallback(async (messageId: string) => {
    if (!onGenerateAudio) return;
    
    try {
      logger.info('Generating audio for message', { messageId });
      await onGenerateAudio(messageId);
    } catch {
      logger.error('Audio generation failed', {messageId});
    }
  }, [onGenerateAudio, logger]);

  // Optimized video generation handler
  const handleGenerateVideo = useCallback(async (messageId: string) => {
    if (!onGenerateVideo) return;
    
    try {
      logger.info('Generating video for message', { messageId });
      await onGenerateVideo(messageId);
    } catch {
      logger.error('Video generation failed', {messageId});
    }
  }, [onGenerateVideo, logger]);

  // Date separator component
  const DateSeparator = memo<{ date: string }>(({ date }) => {
    const isToday = date === new Date().toDateString();
    const isYesterday = date === new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
    
    let displayDate = date;
    if (isToday) displayDate = 'Today';
    else if (isYesterday) displayDate = 'Yesterday';
    else displayDate = new Date(date).toLocaleDateString();

    return (
      <div 
        className="flex items-center justify-center py-4"
        role="separator"
        aria-label={`Messages from ${displayDate}`}
      >
        <div className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {displayDate}
        </div>
      </div>
    );
  });

  DateSeparator.displayName = 'DateSeparator';

  // Virtual items for rendering
  const virtualItems = virtualizer.getVirtualItems();

  // Empty state
  if (messages.length === 0) {
    return (
      <div 
        className={`flex h-full items-center justify-center ${className}`}
        role="status"
        aria-label="No messages"
      >
        <div className="text-center text-muted-foreground">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
            <span className="text-2xl" role="img" aria-label="Dragon">🐉</span>
          </div>
          <h3 className="mb-2 font-semibold">Ready for Adventure</h3>
          <p className="text-sm">Start your D&D journey by sending a message below.</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className={`h-full ${className}`}>
      <div
        className="relative"
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
        }}
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
      >
        {/* Virtual message rendering */}
        {virtualItems.map((virtualItem) => {
          const message = messages[virtualItem.index];
          if (!message) return null;

          return (
            <div
              key={message.id}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {/* Show date separator for first message of the day */}
              {virtualItem.index === 0 || new Date(messages[virtualItem.index - 1].timestamp).toDateString() !== 
               new Date(message.timestamp).toDateString() ? (
                <DateSeparator date={new Date(message.timestamp).toDateString()} />
              ) : null}

              <MessageBubble
                message={message}
                onGenerateImage={handleGenerateImage}
                onGenerateAudio={handleGenerateAudio}
                onGenerateVideo={handleGenerateVideo}
                className="px-4 py-2"
              />
            </div>
          );
        })}

        {/* Loading indicator */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="sticky bottom-4 left-1/2 z-10 -translate-x-1/2"
            >
              <LoadingIndicator />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scroll anchor for auto-scroll */}
        <div
          id="messages-end"
          style={{
            position: 'absolute',
            bottom: 0,
            height: 1,
            width: '100%'
          }}
          aria-hidden="true"
        />
      </div>
    </ScrollArea>
  );
});

MessageList.displayName = 'MessageList';