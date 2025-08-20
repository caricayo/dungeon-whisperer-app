import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { settingsService } from '@/lib/settings';
import { ttsService } from '@/lib/tts';
import { sanitizeInput } from '@/lib/validation';
import { debugLog, debugError } from '@/lib/debug';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import { AnimatedButton, FloatingActionButton } from '@/components/AnimatedElements';
import { 
  Save, 
  Upload, 
  Mic, 
  Image as ImageIcon, 
  Video,
  Clapperboard,
  Film,
  Send, 
  Menu,
  Dice6,
  Scroll,
  Wand2,
  Volume2,
  Loader2,
  Play,
  Pause,
  Square,
  LogOut,
  Shield,
  AlertTriangle,
  AlertCircle,
  X,
  Sparkles,
  Crown,
  Bot,
  User,
  Gauge
} from 'lucide-react';
import dndBackground from '@/assets/dnd-background.jpg';
import { supabase } from "@/integrations/supabase/client";
import { SystemStatus } from '@/components/SystemStatus';
import { UsageTracker } from '@/components/UsageTracker';
import { ErrorHandler, parseError, type ErrorInfo } from '@/components/ErrorHandler';
import { useSessionManager, type Message, type Session } from '@/hooks/useSessionManager';
import { useMultiplayerRealtimeSync } from '@/hooks/useMultiplayerRealtimeSync';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { UsernameSetupModal } from '@/components/UsernameSetupModal';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { guardDemoMode } from '@/lib/demo-mode';
import DemoModeAPIGuard from '@/lib/demo-mode-guard';

// Helper function for generating system prompts
const generateSystemPrompt = (customPrompt?: string) => {
  const basePrompt = "You are a helpful D&D assistant and dungeon master.";
  return customPrompt ? `${basePrompt} ${customPrompt}` : basePrompt;
};
import { VoiceSettings } from '@/components/VoiceSettings';

const DnDChatBot: React.FC = () => {
  const { user } = useAuth();
  const { needsUsername } = useUserProfile();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // Reduced debug logging to minimize console noise
  // console.log('🔍 DnDChatBot: needsUsername =', needsUsername, 'user =', !!user);
  
  // Session management
  const {
    sessions,
    currentSession,
    setCurrentSession,
    createSession: createNewSession,
    deleteSession,
    saveSession,
    exportSession,
    importSession
  } = useSessionManager();

  // Multiplayer realtime sync
  const handleSessionUpdate = (sessionData: any) => {
    if (currentSession?.id === sessionData.id && sessionData.messages) {
      debugLog('🔄 Syncing messages from realtime update');
      const updatedMessages = (sessionData.messages || []).map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
      setMessages(updatedMessages);
      
      // Update current session
      if (currentSession) {
        setCurrentSession(prev => prev ? {
          ...prev,
          messages: updatedMessages
        } : null);
      }
    }
  };

  useMultiplayerRealtimeSync({
    sessionId: currentSession?.isMultiplayer ? currentSession.id : null,
    onSessionUpdate: handleSessionUpdate
  });

  // Sync messages with current session - with error handling
  useEffect(() => {
    try {
      if (currentSession) {
        setMessages(currentSession.messages || []);
        setCustomPrompt(currentSession.customPrompt || '');
      } else {
        setMessages([]);
        setCustomPrompt('');
      }
    } catch (error) {
      debugError('Error syncing session:', error);
      setMessages([]);
      setErrorMessage('Failed to load session. Please refresh.');
    }
  }, [currentSession?.id]); // Only sync when session changes
  
  // Local message state
  const [messages, setMessages] = useState<Message[]>([]);

  // UI state
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(`You are the Dungeon Master for an ongoing 5th Edition Dungeons & Dragons campaign. 
Use official 5e rules for all gameplay (combat, actions, spells, skill checks, saving throws, conditions, initiative, inventory, XP). 
Maintain a persistent log of:
- Player/NPC names, stats, HP, abilities, inventory, gold
- Active quests, visited locations, plot threads
- Rolls made and their results
- Ongoing effects and consequences

At all times, carry forward relevant information from previous scenes so the world remains consistent.

**GAME FLOW**
1. Present the world, scene, or combat state.
2. Offer clear choices or prompt for player actions.
3. Resolve actions by rules, rolling when needed.
4. Update logs after each scene/combat with HP, resources, quest progress.
5. Keep combat in strict initiative order, tracking turns, actions, and conditions.

**STORYTELLING PRIORITY**
🎭 **Describe scenes cinematically** — engage all five senses, build mood and tension, and let the player feel physically present.  
📜 Use vivid imagery, metaphors, and pacing changes to make moments dramatic or suspenseful.  
🗣 Give NPCs distinct personalities, speech patterns, and motivations so they feel alive.  
🌍 Weave in lore, foreshadowing, and callbacks to past events to reward attentive play.  
⚖ Balance realism and fantasy — let the dice shape unexpected twists, but narrate them with flair.  

**PLAYER AGENCY**
- Allow creative, rule-consistent solutions.
- Show consequences of choices (good and bad).
- Encourage exploration, diplomacy, and tactics — not just combat.

**SESSION LOOP**
- Recap the last scene/session.
- Play through the current scene until a decision point or combat round ends.
- Provide an updated game state recap (HP, resources, location, quest status).
- Offer a compelling "What do you do next?" to keep momentum.

**FINAL RULE**
Be fair, consistent, and immersive. Never forget key events or rolls. Let the rules and the story feed each other so it feels like a living, breathing world.`);
  const [showSettings, setShowSettings] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<string>(dndBackground);
  const [hasApiKey, setHasApiKey] = useState(false);

  // Generation states
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [isGeneratingVideoAlt, setIsGeneratingVideoAlt] = useState(false);
  const [runwayOutOfAttempts, setRunwayOutOfAttempts] = useState(false);

  // Audio states
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const currentAudio = useRef<HTMLAudioElement | null>(null);
  const [ttsSpeed, setTtsSpeed] = useState(1.0);

  // Generation logs
  const [generationLogs, setGenerationLogs] = useState<{
    id: string;
    timestamp: Date;
    message: string;
    type: 'info' | 'error' | 'success';
  }[]>([]);

  // Refs
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Helper functions
  const addLog = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const log = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      message,
      type
    };
    setGenerationLogs(prev => [...prev, log]);
  };

  // Auto-scroll preferences state
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(() => {
    const saved = localStorage.getItem('dnd-auto-scroll');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const isNearBottom = () => {
    if (!messagesContainerRef.current) return false;
    const scrollArea = messagesContainerRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollArea) return false;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollArea;
    return scrollHeight - scrollTop - clientHeight < 100; // Within 100px of bottom
  };

  const scrollToBottomWithDelay = (delay = 0, force = false) => {
    setTimeout(() => {
      if (messagesContainerRef.current) {
        const scrollArea = messagesContainerRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollArea) {
          // Only auto-scroll if user is near bottom or force is true
          if (force || autoScrollEnabled && isNearBottom()) {
            scrollArea.scrollTo({
              top: scrollArea.scrollHeight,
              behavior: 'smooth'
            });
          }
        }
      }
    }, delay);
  };

  // Save auto-scroll preference
  useEffect(() => {
    localStorage.setItem('dnd-auto-scroll', JSON.stringify(autoScrollEnabled));
  }, [autoScrollEnabled]);

  const removeMessage = (messageId: string) => {
    try {
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      
      if (currentSession) {
        setCurrentSession(prev => prev ? {
          ...prev,
          messages: prev.messages.filter(msg => msg.id !== messageId)
        } : null);
      }
    } catch (error) {
      debugError('Error removing message:', error);
      setErrorMessage('Failed to remove message');
    }
  };

  // Audio controls
  const handleAudioControl = async (messageId: string, audioUrl: string, action: 'play' | 'pause' | 'stop') => {
    debugLog('🔊 Audio control action:', action, 'for message:', messageId, 'URL:', audioUrl);
    
    if (action === 'stop') {
      if (currentAudio.current) {
        currentAudio.current.pause();
        currentAudio.current.currentTime = 0;
        currentAudio.current = null;
      }
      setCurrentlyPlayingId(null);
      return;
    }

    if (action === 'pause') {
      if (currentAudio.current) {
        currentAudio.current.pause();
        setCurrentlyPlayingId(null); // Clear playing state but keep audio reference
      }
      return;
    }

    if (action === 'play') {
      try {
        // If resuming the same audio
        if (currentAudio.current && currentlyPlayingId === null && audioUrl === currentAudio.current.src) {
          debugLog('🔊 Resuming existing audio');
          await currentAudio.current.play();
          setCurrentlyPlayingId(messageId);
          return;
        }

        // Stop any currently playing audio
        if (currentAudio.current) {
          currentAudio.current.pause();
          currentAudio.current.currentTime = 0;
        }
        
        debugLog('🔊 Creating new audio instance for URL:', audioUrl);
        
        // Validate audio URL
        if (!audioUrl || audioUrl === '') {
          debugError('🔊 Invalid audio URL:', audioUrl);
          return;
        }
        
        // Create new audio instance
        const audio = new Audio();
        
        // Add error handling
        audio.onerror = (e) => {
          debugError('🔊 Audio error:', e);
          debugError('🔊 Audio error details:', audio.error);
          setCurrentlyPlayingId(null);
          currentAudio.current = null;
        };
        
        audio.onloadstart = () => debugLog('🔊 Audio load started');
        audio.onloadeddata = () => debugLog('🔊 Audio data loaded');
        audio.oncanplay = () => debugLog('🔊 Audio can play');
        
        audio.onended = () => {
          debugLog('🔊 Audio playback ended');
          setCurrentlyPlayingId(null);
          currentAudio.current = null;
        };
        
        audio.src = audioUrl;
        audio.playbackRate = ttsSpeed; // Apply current speed setting
        currentAudio.current = audio;
        setCurrentlyPlayingId(messageId);
        
        debugLog('🔊 Starting audio playback...');
        await audio.play();
        debugLog('🔊 Audio playback started successfully');
        
      } catch (error) {
        debugError('🔊 Error playing audio:', error);
        setCurrentlyPlayingId(null);
        currentAudio.current = null;
        
        // Show user-friendly error
        setErrorMessage('Failed to play audio. Please try again.');
      }
    }
  };

  // AI response generation
  const generateAIResponse = async (userMessage: string): Promise<string> => {
    try {
      debugLog('Generating AI response for:', userMessage);
      
      // Prepare conversation history including the new user message
      const conversationMessages = [
        ...messages.slice(-10).map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: 'user', content: userMessage }
      ];
      
      const { data, error } = await DemoModeAPIGuard.guardSupabaseFunction(
        'dnd-chat-v2',
        () => supabase.functions.invoke('dnd-chat-v2', {
          body: {
            messages: conversationMessages,
            customPrompt: customPrompt || undefined
          }
        }),
        {
          operationName: 'AI Chat',
          fallbackData: { 
            data: { content: 'AI chat is disabled in demo mode. Upgrade to unlock AI features.' },
            error: null 
          }
        }
      );

      if (error) {
        throw new Error(error.message || 'Failed to generate AI response');
      }

      debugLog('AI response received:', data);
      
      return data.content || data.response || data.message || "I'm having trouble responding right now. Please try again.";
    } catch (error) {
      debugError('Error generating AI response:', error);
      if (error instanceof Error && error.message.includes('rate limit')) {
        setRateLimitError('You are sending messages too quickly. Please wait a moment before trying again.');
        setTimeout(() => setRateLimitError(null), 5000);
      }
      throw error;
    }
  };

  // Message sending
  const sendMessage = async () => {
    const trimmedMessage = inputMessage.trim();
    if (!trimmedMessage || isLoading) {
      debugLog('SendMessage blocked: empty message or loading');
      return;
    }

    // Clear any previous errors
    setErrorMessage(null);
    setRateLimitError(null);

    // Rate limiting check (simplified)

    const sanitizedInput = sanitizeInput(trimmedMessage);
    
    if (sanitizedInput !== trimmedMessage) {
      toast({
        title: "Input Sanitized",
        description: "Your message contained potentially unsafe content and has been cleaned.",
        variant: "default",
      });
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: sanitizedInput,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputMessage('');
    setIsLoading(true);

    try {
      const aiResponse = await generateAIResponse(sanitizedInput);
      
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);

      // TTS generation now only happens on manual request (via button click)

      // Update session with new messages
      if (currentSession) {
        const updatedSession = { ...currentSession, messages: finalMessages };
        setCurrentSession(updatedSession);
        
        // For multiplayer sessions, use RPC to append messages
        if (currentSession.isMultiplayer) {
          try {
            debugLog('🔄 Appending messages to multiplayer session via RPC');
            await supabase.rpc('append_session_messages', {
              session_id: currentSession.id,
              user_message: {
                id: userMessage.id,
                role: userMessage.role,
                content: userMessage.content,
                timestamp: userMessage.timestamp.toISOString()
              },
              assistant_message: {
                id: assistantMessage.id,
                role: assistantMessage.role,
                content: assistantMessage.content,
                timestamp: assistantMessage.timestamp.toISOString()
              }
            });
            debugLog('🔄 Successfully appended messages to multiplayer session');
          } catch (error) {
            debugError('🔄 Error appending messages to multiplayer session:', error);
            // Fallback to local state only
          }
        } else {
          // For single-player sessions, save normally
          saveSession(updatedSession);
        }
      }

      scrollToBottomWithDelay(100, true); // Force scroll after sending message
    } catch (error) {
      debugError('Error in message generation:', error);
      const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred';
      setErrorMessage(errorMsg);
      
      // Remove the failed message to prevent UI inconsistency
      if (newMessages.length > 0) {
        setMessages(messages); // Revert to original messages
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Image generation
  const generateImage = async () => {
    if (isGeneratingImage || isLoading) {
      debugLog('Image generation blocked: already generating or loading');
      return;
    }
    
    setIsGeneratingImage(true);
    addLog('🎨 Starting image generation...', 'info');
    
    try {
      const lastMessage = messages[messages.length - 1];
      const prompt = lastMessage?.content || inputMessage || "A fantasy D&D scene";
      
      const { data, error } = await DemoModeAPIGuard.guardSupabaseFunction(
        'dnd-image',
        () => supabase.functions.invoke('dnd-image', {
          body: { prompt }
        }),
        {
          operationName: 'AI Image Generation',
          fallbackData: null
        }
      );

      if (error) {
        throw new Error(error.message || 'Failed to generate image');
      }

      if (data?.imageUrl) {
        const imageMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `🎨 **Generated Image**`,
          timestamp: new Date(),
          imageUrl: data.imageUrl,
        };

        setMessages(prev => [...prev, imageMessage]);
        
        if (currentSession) {
          const updatedMessages = [...messages, imageMessage];
          const updatedSession = { ...currentSession, messages: updatedMessages };
          setCurrentSession(updatedSession);
          saveSession(updatedSession);
        }
        
        addLog('🎨 Image generated successfully!', 'success');
      }
    } catch (error) {
      debugError('Error generating image:', error);
      addLog('❌ Failed to generate image', 'error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Video generation with Runway
  const generateVideoRunway = async () => {
    console.log('Runway video generation clicked');
    if (!messages?.length || messages.length < 2) {
      toast({ title: "No Messages", description: "Start a conversation first to generate a video from the AI's response." });
      console.log('Runway generation blocked: no messages');
      return;
    }
    
    setIsGeneratingVideo(true);
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
    
    if (!lastAssistantMessage) {
      toast({ title: "Error", description: "No assistant message found to generate video from." });
      setIsGeneratingVideo(false);
      return;
    }

    try {
      const { data, error } = await DemoModeAPIGuard.guardSupabaseFunction(
        'dnd-video',
        () => supabase.functions.invoke('dnd-video', {
          body: { prompt: lastAssistantMessage.content }
        }),
        {
          operationName: 'AI Video Generation',
          fallbackData: null
        }
      );

      if (error) throw error;

      if (data.taskId) {
        // Poll for completion
        const pollInterval = setInterval(async () => {
          try {
            const { data: statusData, error: statusError } = await DemoModeAPIGuard.guardSupabaseFunction(
              'dnd-video',
              () => supabase.functions.invoke('dnd-video', {
                body: { taskId: data.taskId }
              }),
              {
                operationName: 'Video Status Check',
                showToast: false,
                fallbackData: null
              }
            );

            if (statusError) throw statusError;

            if (statusData.status === 'completed' && statusData.videoUrl) {
              clearInterval(pollInterval);
              
              // Update message with video using reliable state
              const sourceMessages = currentSession?.messages || messages;
              const updatedMessages = sourceMessages.map(msg => 
                msg.id === lastAssistantMessage.id 
                  ? { ...msg, videoUrl: statusData.videoUrl }
                  : msg
              );
              
              // Update both local state and session consistently
              setMessages(updatedMessages);
              
              if (currentSession) {
                const updatedSession = { ...currentSession, messages: updatedMessages };
                setCurrentSession(updatedSession);
                saveSession(updatedSession);
              }
              
              toast({ title: "Success", description: "Runway video generated successfully!" });
              setIsGeneratingVideo(false);
            } else if (statusData.status === 'failed') {
              clearInterval(pollInterval);
              throw new Error('Video generation failed');
            }
          } catch (error) {
            clearInterval(pollInterval);
            console.error('Video polling error:', error);
            toast({ title: "Error", description: "Failed to check video generation status." });
            setIsGeneratingVideo(false);
          }
        }, 3000);
      }
    } catch (error) {
      console.error('Error generating Runway video:', error);
      toast({ title: "Error", description: "Failed to generate Runway video. Please try again." });
      setIsGeneratingVideo(false);
    }
  };

  // Video generation with Luma
  const generateVideoAlternative = async () => {
    console.log('Luma video generation clicked');
    if (!messages?.length || messages.length < 2) {
      toast({ title: "No Messages", description: "Start a conversation first to generate a video from the AI's response." });
      console.log('Luma generation blocked: no messages');
      return;
    }
    
    setIsGeneratingVideoAlt(true);
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
    
    if (!lastAssistantMessage) {
      toast({ title: "Error", description: "No assistant message found to generate video from." });
      setIsGeneratingVideoAlt(false);
      return;
    }

    try {
      console.log('Calling luma-video edge function with prompt:', lastAssistantMessage.content);
      addLog('🎬 Starting Luma video generation...', 'info');
      
      const { data, error } = await DemoModeAPIGuard.guardSupabaseFunction(
        'luma-video',
        () => supabase.functions.invoke('luma-video', {
          body: { prompt: lastAssistantMessage.content }
        }),
        {
          operationName: 'Luma AI Video Generation',
          fallbackData: null
        }
      );

      console.log('Luma video response:', { data, error });

      if (error) {
        console.error('Luma video error:', error);
        
        // Provide user-friendly error messages
        let errorMessage = 'Unknown error';
        if (error.message?.includes('API key')) {
          errorMessage = 'Luma API key not configured. Please contact administrator.';
        } else if (error.message?.includes('rate limit')) {
          errorMessage = 'Rate limit exceeded. Please try again later.';
        } else if (error.message?.includes('Invalid request')) {
          errorMessage = 'Invalid request format. Please try a different prompt.';
        } else {
          errorMessage = error.message || 'Video generation service unavailable';
        }
        
        addLog(`❌ Luma video error: ${errorMessage}`, 'error');
        toast({ 
          title: "Video Generation Failed", 
          description: errorMessage,
          variant: "destructive"
        });
        return;
      }

      if (data?.id) {
        console.log('Luma video generation started with ID:', data.id);
        addLog(`🎬 Video generation started (ID: ${data.id})`, 'info');
        
        // Poll for completion
        const pollInterval = setInterval(async () => {
          try {
            console.log('Polling Luma video status...');
            const { data: statusData, error: statusError } = await DemoModeAPIGuard.guardSupabaseFunction(
              'luma-video',
              () => supabase.functions.invoke('luma-video', {
                body: { taskId: data.id }
              }),
              {
                operationName: 'Luma Video Status Check',
                showToast: false,
                fallbackData: null
              }
            );

            console.log('Luma status response:', { statusData, statusError });

            if (statusError) {
              console.error('Luma status error:', statusError);
              throw statusError;
            }

            if (statusData?.state === 'completed' && statusData?.assets?.video) {
              clearInterval(pollInterval);
              console.log('Luma video completed! Video URL:', statusData.assets.video);
              addLog('✅ Luma video generated successfully!', 'success');
              
              // Update message with video using reliable state
              const sourceMessages = currentSession?.messages || messages;
              const updatedMessages = sourceMessages.map(msg => 
                msg.id === lastAssistantMessage.id 
                  ? { ...msg, videoUrl: statusData.assets.video }
                  : msg
              );
              
              // Update both local state and session consistently
              setMessages(updatedMessages);
              
              if (currentSession) {
                const updatedSession = { ...currentSession, messages: updatedMessages };
                setCurrentSession(updatedSession);
                saveSession(updatedSession);
              }
              
              toast({ title: "Success", description: "Luma video generated successfully!" });
              setIsGeneratingVideoAlt(false);
            } else if (statusData?.state === 'failed') {
              clearInterval(pollInterval);
              console.error('Luma video generation failed');
              addLog('❌ Luma video generation failed', 'error');
              throw new Error('Video generation failed');
            } else {
              console.log('Luma video still processing, state:', statusData?.state);
            }
          } catch (error) {
            clearInterval(pollInterval);
            console.error('Video polling error:', error);
            addLog(`❌ Video polling failed: ${error.message || 'Unknown error'}`, 'error');
            toast({ title: "Error", description: "Failed to check video generation status." });
            setIsGeneratingVideoAlt(false);
          }
        }, 5000);
        
        // Set a timeout to stop polling after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          if (isGeneratingVideoAlt) {
            addLog('⏰ Video generation timeout - stopping polling', 'error');
            setIsGeneratingVideoAlt(false);
          }
        }, 300000); // 5 minutes
      } else {
        console.error('No task ID received from Luma API');
        addLog('❌ No task ID received from Luma API', 'error');
        throw new Error('No task ID received from video generation service');
      }
    } catch (error) {
      console.error('Error generating Luma video:', error);
      addLog(`❌ Luma video generation failed: ${error.message || 'Unknown error'}`, 'error');
      toast({ title: "Error", description: `Failed to generate Luma video: ${error.message || 'Unknown error'}` });
      setIsGeneratingVideoAlt(false);
    }
  };

  // Settings
  const saveSettings = async () => {
    try {
      console.log('Saving custom prompt to user settings...');
      // Save custom prompt to user settings
      await settingsService.saveCustomPrompt(customPrompt);
      
      // Also save to current session
      if (currentSession) {
        const updatedSession = { ...currentSession, customPrompt };
        setCurrentSession(updatedSession);
        saveSession(updatedSession);
      }
      
      toast({
        title: "Settings Saved ✨",
        description: "Your custom D&D prompt has been saved and will be used for all future conversations.",
      });
      console.log('Custom prompt saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Error handling
  const handleRetryFailed = () => {
    setErrorMessage(null);
    if (inputMessage.trim()) {
      sendMessage();
    }
  };

  const handleUsageWarning = (service: string, usage: number) => {
    toast({
      title: `${service} Usage Warning`,
      description: `You have used ${usage}% of your ${service} quota.`,
      variant: "destructive",
    });
  };

  // Keyboard handler
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Check for API key and load TTS speed on mount
  useEffect(() => {
    const checkApiKey = async () => {
      try {
        // The system uses OPENAI_API_KEY secret in Supabase, so API key is always available
        // We just need to verify the user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        setHasApiKey(true); // API key is always available through Supabase edge functions
        console.log('API key status set to available for user:', user?.id);
      } catch (error) {
        console.error('Error checking API key:', error);
        setHasApiKey(true); // Still set to true as edge functions handle API keys
      }
    };
    checkApiKey();
  }, []);

  // Load TTS speed setting and custom prompt after authentication
  useEffect(() => {
    const loadSettings = async () => {
      // Only load settings if user is authenticated
      if (!user) {
        console.log('User not authenticated yet, skipping settings load');
        return;
      }
      
      try {
        console.log('Loading user settings for authenticated user:', user.id);
        const [voiceSettings, customPromptFromSettings] = await Promise.all([
          settingsService.getVoiceSettings(),
          settingsService.getCustomPrompt()
        ]);
        
        if (voiceSettings?.speed) {
          setTtsSpeed(voiceSettings.speed);
          console.log('Loaded TTS speed:', voiceSettings.speed);
        }
        
        if (customPromptFromSettings) {
          setCustomPrompt(customPromptFromSettings);
          console.log('Loaded custom prompt from settings');
        } else {
          console.log('No custom prompt found in settings, using default');
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    
    loadSettings();
  }, [user]); // Depend on user state

  // Conditional auto-scroll when messages change
  useEffect(() => {
    if (messages.length > 0) {
      // Force scroll for new sessions (no previous messages)
      const isNewSession = !currentSession || messages.length <= 2;
      scrollToBottomWithDelay(100, isNewSession);
    }
  }, [messages, currentSession?.id]);

  // Clear chat when no session is selected (after deletion)
  useEffect(() => {
    if (!currentSession) {
      setMessages([]);
      setInputMessage('');
      setErrorMessage(null);
    }
  }, [currentSession]);

  return (
    <SidebarProvider className="h-screen bg-premium-pattern">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative flex h-screen w-full"
      >
        {/* Floating particles background effect */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute size-2 rounded-full bg-primary/20"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -100, 0],
                opacity: [0, 0.6, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 10 + Math.random() * 10,
                repeat: Infinity,
                ease: "easeInOut",
                delay: Math.random() * 5,
              }}
            />
          ))}
        </div>

        <AppSidebar
          sessions={sessions}
          currentSession={currentSession}
          setCurrentSession={setCurrentSession}
          createSession={createNewSession}
          deleteSession={deleteSession}
          exportSession={exportSession}
          importSession={importSession}
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          showLogs={showLogs}
          setShowLogs={setShowLogs}
          customPrompt={customPrompt}
          setCustomPrompt={setCustomPrompt}
          saveSession={saveSession}
          hasApiKey={hasApiKey}
          setHasApiKey={setHasApiKey}
          isGeneratingImage={isGeneratingImage}
          isGeneratingVideo={isGeneratingVideo}
          isGeneratingVideoAlt={isGeneratingVideoAlt}
          generateImage={generateImage}
          generateVideoRunway={generateVideoRunway}
          generateVideoAlternative={generateVideoAlternative}
          generationLogs={generationLogs}
          onRetryFailed={handleRetryFailed}
          onUsageWarning={handleUsageWarning}
        />

        {/* Main Content with Premium Background */}
        <div 
          className="relative flex flex-1 flex-col overflow-hidden backdrop-blur-sm"
          style={{
            backgroundImage: backgroundImage ? `linear-gradient(
              135deg,
              rgba(0, 0, 0, 0.7) 0%,
              rgba(0, 0, 0, 0.4) 50%,
              rgba(0, 0, 0, 0.8) 100%
            ), url(${backgroundImage})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed'
          }}
        >
          {/* Background overlay for better readability */}
          {backgroundImage && (
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/40 to-background/60" />
          )}

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className={`flex items-center justify-between ${isMobile ? 'p-2' : 'p-4'} border-border-elevated relative z-10 shrink-0 border-b bg-card/50 backdrop-blur-sm`}
          >
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="flex size-10 items-center justify-center rounded-full bg-gradient-primary shadow-magical"
                >
                  <Dice6 className="size-5 text-primary-foreground" />
                </motion.div>
                <div>
                  <h1 className="text-gradient-primary font-heading text-xl font-bold">D&D Master</h1>
                  <p className="text-sm text-foreground-muted">
                    {currentSession?.name || 'Ready for adventure'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {errorMessage && (
            <ErrorHandler error={parseError(errorMessage, 'D&D Chat')} onRetry={handleRetryFailed} />
          )}

          {/* Settings Panel */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="bg-card-premium border-border-elevated m-4 border p-4 shadow-premium backdrop-blur-sm">
                  <h3 className="text-gradient-primary mb-4 font-heading text-lg font-semibold">Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-foreground">Custom System Prompt</label>
                      <Textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="Enter your custom D&D system prompt..."
                        className="border-border-elevated mt-1 bg-input/50 focus:border-primary/50"
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={saveSettings} className="bg-gradient-primary">
                        <Save className="mr-2 size-4" />
                        Save Settings
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chat Container - Mobile Responsive with Fixed Input */}
          <div className={`flex-1 ${isMobile ? 'p-1' : 'p-4'} relative z-10 flex min-h-0 flex-col overflow-hidden`}>
            <Card className="bg-card-premium/95 border-border-elevated flex min-h-0 flex-1 flex-col overflow-hidden border shadow-premium backdrop-blur-sm">
              {/* Chat Messages */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              >
                <ScrollArea 
                  className={`flex-1 ${isMobile ? 'p-2' : 'p-4'} relative overflow-auto`} 
                  ref={messagesContainerRef}
                >
              <div className={`space-y-4 ${isMobile ? 'max-w-full' : 'mx-auto max-w-4xl'}`}>
                {messages.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="py-20 text-center"
                  >
                      <div className="bg-gradient-primary/10 glow-mystical float-gentle mb-6 inline-flex size-20 items-center justify-center rounded-full">
                        <Crown className="size-10 text-primary" />
                      </div>
                    <h3 className="text-gradient-primary mb-3 font-heading text-2xl font-semibold">
                      Welcome to Your Epic Adventure
                    </h3>
                    <p className="mx-auto max-w-md leading-relaxed text-foreground-muted">
                      Your AI Dungeon Master awaits. Begin your tale and watch as your story 
                      unfolds with magical possibilities.
                    </p>
                    <motion.div
                      animate={{ 
                        scale: [1, 1.1, 1],
                        opacity: [0.5, 1, 0.5]
                      }}
                      transition={{ 
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      className="mt-8 text-primary"
                    >
                      <Sparkles className="mx-auto size-8" />
                    </motion.div>
                  </motion.div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {messages.map((message, index) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ 
                          duration: 0.4, 
                          delay: index * 0.05,
                          ease: "easeOut"
                        }}
                        className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                      >
                        {/* Avatar */}
                        <Avatar className="size-10 shrink-0 border-2 border-primary/20">
                          <AvatarFallback className={
                            message.role === 'assistant' 
                              ? 'bg-gradient-mystical text-primary' 
                              : 'bg-gradient-primary text-primary-foreground'
                          }>
                            {message.role === 'assistant' ? <Bot className="size-5" /> : <User className="size-5" />}
                          </AvatarFallback>
                        </Avatar>

                        {/* Message Content */}
                        <div className={`flex flex-col ${isMobile ? 'max-w-[85%]' : 'max-w-[75%]'} ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                           <motion.div
                            whileHover={{ y: -2, transition: { duration: 0.2 } }}
                            className={`
                              group relative backdrop-blur-sm transition-all duration-300 ${isMobile ? 'rounded-lg p-3' : 'rounded-2xl p-4'}
                              ${message.role === 'user'
                                ? 'bg-gradient-primary text-primary-foreground shadow-glow'
                                : 'bg-card-premium border-border-elevated border text-card-foreground hover:shadow-elevated'
                              }
                            `}
                          >
                            {/* Remove button */}
                            <motion.button
                              initial={{ scale: 0 }}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-lg transition-all duration-300 group-hover:opacity-100"
                              onClick={() => removeMessage(message.id)}
                              title="Remove message"
                            >
                              <X className="size-3" />
                            </motion.button>

                            {/* Message decorations for AI */}
                            {message.role === 'assistant' && (
                              <div className="absolute -left-2 top-4 size-3 animate-pulse rounded-full bg-primary/50" />
                            )}
                            
                            <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
                            
                            {message.imageUrl && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.3 }}
                                className="mt-4"
                              >
                                <motion.img 
                                  whileHover={{ scale: 1.05 }}
                                  transition={{ duration: 0.3 }}
                                  src={message.imageUrl} 
                                  alt="Generated D&D scene" 
                                  className="border-border-elevated max-w-full cursor-pointer rounded-xl border transition-all duration-300 hover:shadow-magical"
                                  onLoad={() => scrollToBottomWithDelay(100, true)}
                                  onClick={() => {
                                    setBackgroundImage(message.imageUrl);
                                    toast({
                                      title: "Background Updated! ✨",
                                      description: "The scene now serves as your adventure backdrop.",
                                    });
                                  }}
                                  title="Click to set as background"
                                />
                              </motion.div>
                            )}
                            
                            {message.videoUrl && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.3 }}
                                className="mt-4"
                              >
                                <video 
                                  src={message.videoUrl} 
                                  controls
                                  className="border-border-elevated w-full max-w-full rounded-xl border"
                                  style={{ maxHeight: '300px' }}
                                  onLoadedData={() => scrollToBottomWithDelay(100, true)}
                                >
                                  Your browser does not support the video tag.
                                </video>
                              </motion.div>
                             )}
                             
                             {/* Audio Controls for TTS */}
                             {message.role === 'assistant' && (
                               <motion.div 
                                 initial={{ opacity: 0, x: -20 }}
                                 animate={{ opacity: 1, x: 0 }}
                                 transition={{ delay: 0.5 }}
                                 className="mt-3 flex items-center gap-2"
                               >
                                  {message.isGeneratingAudio ? (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <Loader2 className="size-4 animate-spin" />
                                      <span>Generating audio...</span>
                                    </div>
                                  ) : message.ttsError ? (
                                    <div className="flex items-center gap-2 text-sm text-destructive">
                                      <AlertCircle className="size-4" />
                                      <span>Audio generation failed</span>
                                      <AnimatedButton
                                        onClick={async () => {
                                          try {
                                            setMessages(prev => prev.map(msg => 
                                              msg.id === message.id 
                                                ? { ...msg, isGeneratingAudio: true, ttsError: null }
                                                : msg
                                            ));
                                            
                                             const audioUrl = await ttsService.generateSpeech(message.content, { speed: ttsSpeed });
                                            
                                            setMessages(prev => prev.map(msg => 
                                              msg.id === message.id 
                                                ? { ...msg, audioUrl, isGeneratingAudio: false, ttsError: null }
                                                : msg
                                            ));
                                          } catch (error) {
                                            setMessages(prev => prev.map(msg => 
                                              msg.id === message.id 
                                                ? { ...msg, isGeneratingAudio: false, ttsError: error.message }
                                                : msg
                                            ));
                                          }
                                        }}
                                        variant="outline"
                                        size="sm"
                                        className="h-6 px-2 text-xs"
                                      >
                                        Retry
                                      </AnimatedButton>
                                    </div>
                                   ) : message.audioUrl ? (
                                      <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                          <AnimatedButton
                                            onClick={() => handleAudioControl(
                                              message.id, 
                                              message.audioUrl, 
                                              currentlyPlayingId === message.id ? 'pause' : 'play'
                                            )}
                                            variant="outline"
                                            size="sm"
                                            className="size-8 p-0"
                                            title={currentlyPlayingId === message.id ? "Pause narration" : "Play narration"}
                                          >
                                            {currentlyPlayingId === message.id ? (
                                              <Pause className="size-4" />
                                            ) : (
                                              <Play className="size-4" />
                                            )}
                                          </AnimatedButton>
                                          
                                          <AnimatedButton
                                            onClick={() => handleAudioControl(message.id, message.audioUrl, 'stop')}
                                            variant="outline"
                                            size="sm"
                                            className="size-8 p-0"
                                            title="Stop narration"
                                          >
                                            <Square className="size-4" />
                                          </AnimatedButton>
                                        </div>
                                        
                                        {/* Speed Control */}
                                        <div className="flex items-center gap-2">
                                          <Gauge className="size-3 text-muted-foreground" />
                                          <div className="flex items-center gap-1">
                                            <Slider
                                              value={[ttsSpeed]}
                                              onValueChange={(value) => {
                                                const newSpeed = value[0];
                                                console.log('🎵 Speed slider changed to:', newSpeed);
                                                setTtsSpeed(newSpeed);
                                                // Apply speed immediately to current audio
                                                if (currentAudio.current && currentlyPlayingId === message.id) {
                                                  console.log('🎵 Applying speed to current audio:', newSpeed);
                                                  currentAudio.current.playbackRate = newSpeed;
                                                }
                                                // Save speed setting
                                                settingsService.saveVoiceSettings(undefined, undefined, newSpeed).catch(console.error);
                                              }}
                                              min={0.5}
                                              max={2.0}
                                              step={0.1}
                                              className="w-16"
                                            />
                                            <span className="w-8 text-xs text-muted-foreground">
                                              {ttsSpeed.toFixed(1)}x
                                            </span>
                                          </div>
                                        </div>
                                       
                                       <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                         <Volume2 className="size-3" />
                                         Narration {currentlyPlayingId === message.id && '(Playing)'}
                                       </span>
                                     </div>
                                  ) : (
                                    <AnimatedButton
                                      onClick={async () => {
                                        try {
                                          setMessages(prev => prev.map(msg => 
                                            msg.id === message.id 
                                              ? { ...msg, isGeneratingAudio: true }
                                              : msg
                                          ));
                                          
                                          const audioUrl = await ttsService.generateSpeech(message.content, { speed: ttsSpeed });
                                          
                                          setMessages(prev => prev.map(msg => 
                                            msg.id === message.id 
                                              ? { ...msg, audioUrl, isGeneratingAudio: false }
                                              : msg
                                          ));
                                        } catch (error) {
                                          setMessages(prev => prev.map(msg => 
                                            msg.id === message.id 
                                              ? { ...msg, isGeneratingAudio: false, ttsError: error.message }
                                              : msg
                                          ));
                                        }
                                      }}
                                      variant="outline"
                                      size="sm"
                                      className="size-8 p-0"
                                      title="Generate narration"
                                    >
                                      <Volume2 className="size-4" />
                                    </AnimatedButton>
                                  )}
                               </motion.div>
                             )}
                           </motion.div>
                          
                          <motion.span 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="mt-1 px-2 text-xs text-muted-foreground"
                          >
                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </motion.span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
                </div>
                </ScrollArea>
              </motion.div>

              {/* Chat Input Area - Sticky at bottom */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className={`border-border-elevated border-t ${isMobile ? 'p-2' : 'p-4'} bg-card-premium/95 sticky bottom-0 shrink-0 backdrop-blur-sm`}
                >
              {rateLimitError && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-4"
                >
                  <Alert className="border-destructive/20 bg-destructive/10" variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertDescription>{rateLimitError}</AlertDescription>
                  </Alert>
                </motion.div>
              )}
              
                 <div className={`flex ${isMobile ? 'gap-2' : 'gap-3'} items-end`}>
                <div className="relative flex-1">
                  <Textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Whisper your tale to the realm... ✨"
                    disabled={isLoading}
                    className={`${isMobile ? 'max-h-[80px] min-h-[40px] text-sm' : 'max-h-[120px] min-h-[48px]'} border-border-elevated resize-none bg-input/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 ${isMobile ? 'rounded-lg' : 'rounded-xl'} backdrop-blur-sm transition-all duration-300`}
                    rows={isMobile ? 1 : 1}
                  />
                  
                  {/* Magic sparkle effect on input focus */}
                  <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-primary opacity-0 transition-opacity duration-300 hover:opacity-5" />
                </div>
                
                {/* Action Buttons */}
                <div className={`flex ${isMobile ? 'gap-1' : 'gap-2'}`}>
                  {!isMobile && (
                    <AnimatedButton
                      onClick={generateImage}
                      disabled={isGeneratingImage || isLoading}
                      variant="outline"
                      size="md"
                      className="size-12 p-0"
                      title="Generate D&D Image from text"
                      hoverLift={true}
                    >
                    {isGeneratingImage ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Loader2 className="size-5" />
                      </motion.div>
                      ) : (
                        <ImageIcon className="size-5" />
                      )}
                    </AnimatedButton>
                  )}

                  <AnimatedButton
                    onClick={sendMessage}
                    disabled={isLoading || !inputMessage.trim()}
                    variant="primary"
                    size="md"
                    className={`${isMobile ? 'size-10' : 'size-12'} p-0`}
                    glowEffect={!!inputMessage.trim()}
                    hoverLift={true}
                  >
                    {isLoading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Loader2 className="size-5" />
                      </motion.div>
                  ) : (
                    <Send className={`${isMobile ? 'size-4' : 'size-5'}`} />
                  )}
                </AnimatedButton>
              </div>
            </div>

            {/* Quick Prompts - Hidden on mobile */}
            {!isMobile && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-4 flex gap-2 overflow-x-auto pb-2"
              >
                {[
                  "🎲 Roll for initiative",
                  "🏰 Describe the scene",
                  "👑 Generate an NPC",
                  "⚔️ Start combat"
                ].map((prompt, index) => (
                  <motion.button
                    key={index}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setInputMessage(prompt.split(' ').slice(1).join(' '))}
                    className="border-border-elevated whitespace-nowrap rounded-lg border bg-card/50 px-3 py-1.5 text-xs transition-all duration-300 hover:bg-card-elevated hover:shadow-elevated"
                  >
                    {prompt}
                  </motion.button>
                  ))}
                </motion.div>
              )}
              </motion.div>
            </Card>
          </div>
        </div>

        {/* Floating Action Buttons */}
        <FloatingActionButton
          icon={Dice6}
          onClick={() => setInputMessage("Roll a d20")}
          position="bottom-right"
          tooltip="Quick dice roll"
          color="primary"
        />
        
        <FloatingActionButton
          icon={Wand2}
          onClick={() => setInputMessage("Cast a spell")}
          position="bottom-left"
          tooltip="Cast magic"
          color="secondary"
        />
      </motion.div>
      
      {/* Global Username Setup Modal for main chat interface */}
      <UsernameSetupModal isOpen={needsUsername} />
    </SidebarProvider>
  );
};

export default DnDChatBot;