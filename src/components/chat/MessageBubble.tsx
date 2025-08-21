/**
 * @fileoverview Message bubble component with actions
 */

import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Message } from '@/domains/chat/types';
import { User, Bot, Image, Volume2, Video } from 'lucide-react';
import { ReadReceiptIndicator } from '@/components/ReadReceiptIndicator';
import { useReadReceipts } from '@/hooks/useReadReceipts';
import { DemoGuard } from '@/components/ui/demo-guard';
import { guardDemoMode } from '@/lib/demo-mode';

interface MessageBubbleProps {
  message: Message & { 
    isToday: boolean; 
    formattedTime: string; 
  };
  onGenerateImage?: (messageId: string) => Promise<void>;
  onGenerateAudio?: (messageId: string) => Promise<void>;
  onGenerateVideo?: (messageId: string) => Promise<void>;
  sessionId?: string | null;
  className?: string;
}

export const MessageBubble = memo<MessageBubbleProps>(({ 
  message, 
  onGenerateImage, 
  onGenerateAudio, 
  onGenerateVideo,
  sessionId = null,
  className = '' 
}) => {
  const isUser = message.role === 'user';
  const { markMessageAsRead } = useReadReceipts(sessionId);
  
  // Break content into paragraphs for better mobile readability
  const formatMessageContent = (content: string) => {
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    
    return paragraphs.map((paragraph, _index) => {
      // For mobile, break long paragraphs into shorter chunks
      const isMobile = window.innerWidth < 768;
      if (!isMobile || paragraph.length < 150) {
        return (
          <div key={index} className={index > 0 ? 'mt-3' : ''}>
            {paragraph}
          </div>
        );
      }
      
      // Split long paragraphs for mobile
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      const chunks: string[] = [];
      let currentChunk = '';
      
      sentences.forEach(sentence => {
        if ((currentChunk + sentence).length > 120) {
          if (currentChunk) chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          currentChunk += (currentChunk ? ' ' : '') + sentence;
        }
      });
      
      if (currentChunk) chunks.push(currentChunk.trim());
      
      return (
        <div key={index} className={index > 0 ? 'mt-3' : ''}>
          {chunks.map((chunk, chunkIndex) => (
            <div key={chunkIndex} className={chunkIndex > 0 ? 'mt-2' : ''}>
              {chunk}
            </div>
          ))}
        </div>
      );
    });
  };
  
  return (
    <div className={`flex gap-2 md:gap-3 ${isUser ? 'flex-row-reverse' : ''} ${className} px-1`}>
      <Avatar className="size-6 shrink-0 md:size-8">
        <AvatarFallback>
          {isUser ? <User className="size-3 md:size-4" /> : <Bot className="size-3 md:size-4" />}
        </AvatarFallback>
      </Avatar>
      
      <div className={`flex max-w-[88%] flex-col md:max-w-[80%] ${isUser ? 'items-end' : 'items-start'} min-w-0`}>
        <div
          className={`break-words rounded-lg p-2 transition-all duration-300 md:p-3 ${
            isUser 
              ? 'bg-primary text-primary-foreground hover:shadow-glow' 
              : 'interactive-hover bg-muted text-muted-foreground hover:bg-muted-elevated'
          }`}
        >
          <div className="whitespace-pre-wrap text-xs leading-relaxed sm:text-sm md:text-base">
            {formatMessageContent(message.content)}
          </div>
          
          {message.attachments?.imageUrl && (
            <img 
              src={message.attachments.imageUrl} 
              alt="Generated content" 
              className="mt-2 w-full max-w-full rounded-lg object-contain"
              style={{ maxHeight: window.innerWidth < 768 ? '200px' : '300px' }}
            />
          )}
          
          {message.attachments?.audioUrl && (
            <audio 
              controls 
              className="mt-2 w-full max-w-full"
              src={message.attachments.audioUrl}
              style={{ height: window.innerWidth < 768 ? '32px' : '40px' }}
            />
          )}
          
          {message.attachments?.videoUrl && (
            <video 
              controls 
              className="mt-2 w-full max-w-full rounded-lg object-contain"
              src={message.attachments.videoUrl}
              style={{ maxHeight: window.innerWidth < 768 ? '200px' : '300px' }}
            >
              Your browser does not support the video tag.
            </video>
          )}
        </div>
        
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted-foreground">
            {message.formattedTime}
          </span>
          
          {/* Read receipt indicator for user messages */}
          {isUser && sessionId && (
            <ReadReceiptIndicator 
              messageId={message.id} 
              sessionId={sessionId}
              className="ml-1"
            />
          )}
          
          {!isUser && (
            <div className="ml-1 flex gap-1 md:ml-2">
              <DemoGuard feature="AI Image Generation" showFallback={false}>
                {onGenerateImage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (guardDemoMode('AI Image Generation')) return;
                      onGenerateImage(message.id);
                    }}
                    className="size-[44px] touch-manipulation p-0 md:size-6"
                    title="Generate Image"
                    aria-label="Generate image for this message"
                  >
                    <Image className="size-3 md:size-4" />
                  </Button>
                )}
              </DemoGuard>
              
              <DemoGuard feature="AI Audio Generation" showFallback={false}>
                {onGenerateAudio && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (guardDemoMode('AI Audio Generation')) return;
                      onGenerateAudio(message.id);
                    }}
                    className="size-[44px] touch-manipulation p-0 md:size-6"
                    title="Generate Audio"
                    aria-label="Generate audio for this message"
                  >
                    <Volume2 className="size-3 md:size-4" />
                  </Button>
                )}
              </DemoGuard>
              
              <DemoGuard feature="AI Video Generation" showFallback={false}>
                {onGenerateVideo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (guardDemoMode('AI Video Generation')) return;
                      onGenerateVideo(message.id);
                    }}
                    className="size-[44px] touch-manipulation p-0 md:size-6"
                    title="Generate Video"
                    aria-label="Generate video for this message"
                  >
                    <Video className="size-3 md:size-4" />
                  </Button>
                )}
              </DemoGuard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';