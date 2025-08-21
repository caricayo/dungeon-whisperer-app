/**
 * @fileoverview Chat input component with message sending
 */

import React, { memo, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Lock, BookOpen, ExternalLink } from 'lucide-react';
// Note: sanitizeInput and validateInput available but not currently used
// import { sanitizeInput, validateInput } from '@/lib/validation';
import { useTypingIndicators } from '@/hooks/useTypingIndicators';
import { guardDemoMode, isDemoMode } from '@/lib/demo-mode';
import { InputSanitizer, SecurityLogger } from '@/lib/security';
import { useToast } from '@/hooks/use-toast';
import { useSecurityMonitor } from '@/hooks/useSecurityMonitor';
import { detectTechTerms, generateContext7Url, shouldShowContext7Suggestion } from '@/lib/tech-detection';
import { useUserSettings } from '@/hooks/useUserSettings';

interface ChatInputProps {
  onSendMessage: (content: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  sessionId?: string | null;
}

export const ChatInput = memo<ChatInputProps>(({ 
  onSendMessage, 
  disabled = false, 
  placeholder = "Type your message...", 
  className = '',
  sessionId = null
}) => {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { startTyping, stopTyping } = useTypingIndicators(sessionId);
  const { toast } = useToast();
  const { reportSecurityEvent } = useSecurityMonitor();
  const { settings } = useUserSettings();
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Detect tech terms for Context7 suggestions
  const techDetection = detectTechTerms(message);
  const showContext7Button = shouldShowContext7Suggestion(settings) && 
    techDetection.hasTechTerms && 
    message.trim().length > 10; // Only show for substantial input

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || disabled || isSubmitting) return;

    // Demo mode guard with enhanced UX
    if (guardDemoMode('Message sending')) {
      return;
    }

    // Enhanced security validation
    const cleanMessage = InputSanitizer.sanitizeText(message.trim());
    if (!cleanMessage) {
      toast({
        variant: 'destructive',
        title: 'Invalid message',
        description: 'Please check your message content',
      });
      return;
    }

    // Check for suspicious patterns
    if (/<script|javascript:|on\w+\s*=/i.test(message)) {
      reportSecurityEvent('xss_attempt', { context: 'ChatInput', messageLength: message.length });
      toast({
        variant: 'destructive',
        title: 'Security Alert',
        description: 'Message contains potentially harmful content',
      });
      return;
    }

    // Stop typing indicator
    stopTyping();

    setIsSubmitting(true);
    try {
      await onSendMessage(cleanMessage);
      setMessage('');
      
      // Log successful message send for security monitoring
      SecurityLogger.logSecurityEvent('message_sent', {
        messageLength: cleanMessage.length,
        sessionId: sessionId ?? 'unknown',
      });
    } catch {
      console.error('Failed to send message:', _error);
      toast({
        variant: 'destructive',
        title: 'Send failed',
        description: 'Unable to send message. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [message, disabled, isSubmitting, onSendMessage, stopTyping, toast, reportSecurityEvent, sessionId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as React.FormEvent);
    }
  }, [handleSubmit]);

  // Handle typing indicators
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newMessage = e.target.value;
    setMessage(newMessage);

    // Don't send typing indicators in demo mode
    if (isDemoMode) return;

    // Start typing if there's content
    if (newMessage.trim() && sessionId) {
      startTyping();
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing after 1 second of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 1000);
    } else if (!newMessage.trim()) {
      stopTyping();
    }
  }, [sessionId, startTyping, stopTyping]);

  const handleOpenContext7 = useCallback(() => {
    if (techDetection.suggestedQuery) {
      const url = generateContext7Url(techDetection.suggestedQuery);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [techDetection.suggestedQuery]);

  return (
    <form onSubmit={handleSubmit} className={`p-2 md:p-4 ${className}`}>
      {showContext7Button && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-muted/50 p-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="size-4" />
            <span>Detected: {techDetection.detectedTechs.join(', ')}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenContext7}
            className="gap-1 text-xs"
          >
            <ExternalLink className="size-3" />
            Open latest docs (Context7)
          </Button>
        </div>
      )}
      <div className="flex gap-2 md:gap-3">
        <Textarea
          data-testid="message-input"
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSubmitting}
          className="min-h-[40px] resize-none text-xs sm:text-sm md:min-h-[60px] md:text-base"
          rows={window.innerWidth < 768 ? 2 : 3}
        />
        <Button
          type="submit"
          disabled={!message.trim() || disabled || isSubmitting}
          size="sm"
          className="relative h-[44px] min-w-[44px] px-3 md:h-[60px] md:px-4"
          aria-label="Send message"
        >
          {isDemoMode && (
            <Lock className="absolute right-1 top-1 size-3 text-muted-foreground md:size-4" />
          )}
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin md:size-5" />
          ) : (
            <Send className="size-4 md:size-5" />
          )}
        </Button>
      </div>
    </form>
  );
});

ChatInput.displayName = 'ChatInput';