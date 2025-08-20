import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, Image, Sparkles, Bot, User, Crown, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  type?: 'text' | 'image' | 'dice' | 'story';
}

interface PremiumChatInterfaceProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isTyping?: boolean;
  placeholder?: string;
}

export function PremiumChatInterface({
  messages,
  onSendMessage,
  isTyping = false,
  placeholder = "Whisper your tale to the realm..."
}: PremiumChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-card-premium border-border-elevated flex h-full flex-col overflow-hidden rounded-2xl border shadow-premium">
      {/* Chat Header */}
      <div className="border-border-elevated flex items-center justify-between border-b bg-gradient-card p-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="size-10 border-2 border-primary/20">
              <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                <Crown className="size-5" />
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 size-4 animate-pulse rounded-full border-2 border-card bg-success" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-foreground">AI Dungeon Master</h3>
            <p className="text-sm text-foreground-muted">Ready to weave your tale</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-foreground-muted">
            <div className="size-2 animate-pulse rounded-full bg-success" />
            Online
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-6">
        <div className="space-y-6">
          <AnimatePresence>
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={`flex gap-4 ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback className={
                    message.sender === 'ai' 
                      ? 'bg-gradient-mystical text-primary'
                      : 'bg-gradient-primary text-primary-foreground'
                  }>
                    {message.sender === 'ai' ? <Bot className="size-4" /> : <User className="size-4" />}
                  </AvatarFallback>
                </Avatar>

                {/* Message Content */}
                <div className={`flex max-w-[80%] flex-col ${message.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`
                    relative rounded-2xl px-4 py-3 backdrop-blur-sm transition-all duration-300 hover:shadow-elevated
                    ${message.sender === 'ai' 
                      ? 'border-border-elevated border bg-card-elevated/80 text-foreground' 
                      : 'bg-gradient-primary text-primary-foreground'
                    }
                  `}>
                    {/* Message Type Indicator */}
                    {message.type && message.type !== 'text' && (
                      <div className="mb-2 flex items-center gap-1 text-xs opacity-70">
                        {message.type === 'story' && <Wand2 className="size-3" />}
                        {message.type === 'dice' && <Sparkles className="size-3" />}
                        {message.type === 'image' && <Image className="size-3" />}
                        {message.type}
                      </div>
                    )}
                    
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </p>
                    
                    {/* Message decorations for AI */}
                    {message.sender === 'ai' && (
                      <div className="absolute -left-1 top-3 size-2 animate-pulse rounded-full bg-primary/50" />
                    )}
                  </div>
                  
                  <span className="mt-1 px-2 text-xs text-foreground-muted">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing Indicator */}
          <AnimatePresence>
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex gap-4"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="bg-gradient-mystical text-primary">
                    <Bot className="size-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="border-border-elevated rounded-2xl border bg-card-elevated/80 px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="size-2 rounded-full bg-primary"
                        animate={{ scale: [1, 1.5, 1] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: i * 0.2,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-border-elevated border-t bg-gradient-card p-6">
        <div className="flex items-end gap-4">
          <div className="relative flex-1">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              className="border-border-elevated max-h-[120px] min-h-[48px] resize-none rounded-xl bg-input/50 pr-12 backdrop-blur-sm transition-all duration-300 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              rows={1}
            />
            
            {/* Quick Actions */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="size-6 p-0 hover:bg-accent/20"
                onClick={() => setIsRecording(!isRecording)}
              >
                <Mic className={`size-4 ${isRecording ? 'animate-pulse text-destructive' : 'text-foreground-muted'}`} />
              </Button>
            </div>
          </div>

          <Button
            onClick={handleSend}
            disabled={!input.trim()}
            className="group size-12 rounded-xl bg-gradient-primary text-primary-foreground transition-all duration-300 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="size-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Button>
        </div>

        {/* Quick Prompts */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {[
            "Start a new adventure",
            "Roll for initiative",
            "Describe the scene",
            "Generate an NPC"
          ].map((prompt, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => setInput(prompt)}
              className="border-border-elevated whitespace-nowrap bg-card/50 text-xs hover:bg-card-elevated"
            >
              {prompt}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}