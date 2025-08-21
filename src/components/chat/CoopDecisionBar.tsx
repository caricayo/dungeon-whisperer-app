import React, { memo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Users, Zap, Clock, Send } from 'lucide-react';
import { useCoopDecision } from '@/hooks/useCoopDecision';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface CoopDecisionBarProps {
  sessionId: string;
  onSendCombined: (content: string) => Promise<void>;
}

export const CoopDecisionBar = memo(({ sessionId, onSendCombined }: CoopDecisionBarProps) => {
  // Debug session ID (can be removed after testing)
  if (sessionId === '' || !sessionId) {
    console.warn('🎮 CoopDecisionBar: Invalid sessionId:', sessionId);
  }
  
  const { user } = useAuth();
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const {
    myAction,
    isReady,
    peers,
    everyoneReady,
    combinedPrompt,
    setAction,
    toggleReady,
    reset,
  } = useCoopDecision(sessionId);

  const handleSend = async () => {
    if (!combinedPrompt) return;
    console.log('🎮 Sending combined prompt:', combinedPrompt);
    await onSendCombined(combinedPrompt);
    reset();
  };

  const handleActionChange = (text: string) => {
    setAction(text);
    
    // Handle typing indicator
    if (!isTyping) {
      setIsTyping(true);
    }
    
    // Clear existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    // Set new timeout to stop typing after 1 second
    const newTimeout = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
    setTypingTimeout(newTimeout);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [typingTimeout]);

  // Show a fallback if sessionId is invalid
  if (!sessionId || sessionId === '') {
    return (
      <div className="border-b border-border bg-destructive/10 p-3">
        <div className="text-sm text-destructive">
          ⚠️ Multiplayer session not properly connected. Please try rejoining the session.
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b border-border bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20"
    >
      <Card className="border-none bg-transparent shadow-none">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="size-5 text-blue-600" />
              Party Coordination
            </CardTitle>
            <AnimatePresence>
              {everyoneReady && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                >
                  <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                    <CheckCircle2 className="size-3" /> 
                    Ready to send to GM!
                  </Badge>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* My Action Input */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-amber-600" />
              <span className="text-sm font-medium">Your Action This Turn</span>
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-1 text-xs text-muted-foreground"
                >
                  <div className="flex space-x-1">
                    <div className="size-1 animate-bounce rounded-full bg-current"></div>
                    <div className="size-1 animate-bounce rounded-full bg-current" style={{ animationDelay: '0.1s' }}></div>
                    <div className="size-1 animate-bounce rounded-full bg-current" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  typing...
                </motion.div>
              )}
            </div>
            
            <div className="flex items-start gap-2">
              <Textarea
                value={myAction}
                onChange={(e) => handleActionChange(e.target.value)}
                placeholder="What will you do this turn? (e.g., 'I cast fireball at the orcs', 'I try to sneak past the guards')"
                className="min-h-[80px] resize-none text-sm"
                rows={3}
              />
              <Button
                variant={isReady ? 'default' : 'outline'}
                onClick={toggleReady}
                size="lg"
                className="min-w-[100px] whitespace-nowrap"
                disabled={!myAction.trim()}
              >
                {isReady ? (
                  <>
                    <CheckCircle2 className="mr-1 size-4" />
                    Ready
                  </>
                ) : (
                  <>
                    <Clock className="mr-1 size-4" />
                    Mark Ready
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Party Members Status */}
          {peers.length === 1 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Waiting for other players to join...</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Share the session join link to invite other players to coordinate actions together!
              </div>
            </div>
          ) : peers.length > 1 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-blue-600" />
                <span className="text-sm font-medium">Party Members ({peers.length})</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {peers.filter(p => p.user_id !== user?.id).map((p) => (
                  <motion.div
                    key={p.user_id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`rounded-lg border p-2 ${
                      p.ready && p.action?.trim() 
                        ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20' 
                        : 'border-border bg-muted/30'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium">{p.username}</span>
                      {p.ready && p.action?.trim() ? (
                        <Badge variant="default" size="sm" className="bg-green-600">
                          <CheckCircle2 className="mr-1 size-3" />
                          Ready
                        </Badge>
                      ) : (
                        <Badge variant="outline" size="sm">
                          <Clock className="mr-1 size-3" />
                          Planning
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.action?.trim() ? `"${p.action}"` : 'Still planning their action...'}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Combined Prompt - Only show when everyone is ready */}
          <AnimatePresence>
            {combinedPrompt && everyoneReady && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Send className="size-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    Combined Party Action Ready!
                  </span>
                </div>
                
                <Card className="border-green-200 bg-gradient-to-r from-green-50 to-blue-50 dark:border-green-800 dark:from-green-950/20 dark:to-blue-950/20">
                  <CardContent className="space-y-3 p-4">
                    <Textarea 
                      value={combinedPrompt} 
                      readOnly 
                      className="min-h-[120px] bg-white/50 text-sm dark:bg-black/20" 
                    />
                    <div className="flex justify-end">
                      <Button 
                        onClick={handleSend} 
                        disabled={!everyoneReady}
                        size="lg"
                        className="bg-green-600 text-white hover:bg-green-700"
                      >
                        <Send className="mr-2 size-4" />
                        Send to GM
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
});

CoopDecisionBar.displayName = 'CoopDecisionBar';
