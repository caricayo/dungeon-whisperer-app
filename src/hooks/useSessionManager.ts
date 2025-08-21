import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useChatDiagnostics } from '@/hooks/useChatDiagnostics';
import { debugLog, debugError } from '@/lib/debug';
import { useRealtimeManager, SubscriptionConfig } from '@/hooks/useRealtimeManager';
import { debounce } from '@/lib/performance-monitor';
import type { Message, Session } from '@/types/session';

// Raw data interfaces for localStorage deserialization
interface RawMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // Date as string from JSON
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  videoTaskId?: string;
  isGeneratingAudio?: boolean;
  ttsError?: string;
}

// Type for Supabase JSON data
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

interface RawSession {
  id: string;
  name: string;
  messages?: RawMessage[];
  customPrompt: string;
  createdAt: string; // Date as string from JSON
  updatedAt?: string;
  isSynced?: boolean;
  isMultiplayer?: boolean;
}

// ChatGPT export format interfaces
interface ChatGPTMessage {
  content: {
    parts: string[];
  };
  author: {
    role: string;
  };
  create_time: number;
}

interface ChatGPTNode {
  message?: ChatGPTMessage;
}

export const useSessionManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { handleError: _handleError, handleSuccess: _handleSuccess } = useErrorHandler();
  const { runDiagnostics: _runDiagnostics } = useChatDiagnostics();
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Debounced session reload to prevent excessive calls
  const debouncedLoadSessions = useMemo(
    () => debounce(() => loadSessions(), 1000),
    [] // Empty deps - create only once
  );

  // Set up real-time subscriptions for session participant changes
  const realtimeConfigs: SubscriptionConfig[] = useMemo(() => user ? [
    {
      table: 'session_participants',
      event: 'INSERT',
      filter: `user_id=eq.${user.id}`,
      callback: (_payload) => {
        debugLog('Session participant INSERT - reloading sessions');
        debouncedLoadSessions();
      }
    },
    {
      table: 'session_participants',
      event: 'DELETE',
      filter: `user_id=eq.${user.id}`,
      callback: (_payload) => {
        debugLog('Session participant DELETE - reloading sessions');
        debouncedLoadSessions();
      }
    },
    {
      table: 'session_participants',
      event: 'UPDATE',
      filter: `user_id=eq.${user.id}`,
      callback: (_payload) => {
        debugLog('Session participant UPDATE - reloading sessions');
        debouncedLoadSessions();
      }
    }
  ] : [], [user?.id, debouncedLoadSessions]);

  useRealtimeManager(realtimeConfigs);

  // Load sessions from Supabase (primary) and localStorage (fallback)
  const loadSessions = useCallback(async () => {
    if (!user) {
      // Load from localStorage for non-authenticated users only
      const localSessions = localStorage.getItem('dnd-sessions');
      if (localSessions) {
        try {
          const parsed = JSON.parse(localSessions);
          // Convert timestamp strings back to Date objects for localStorage sessions
          const convertedSessions = (parsed as RawSession[]).map((session) => ({
            ...session,
            messages: session.messages?.map((msg) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            })) ?? [],
            createdAt: new Date(session.createdAt),
            updatedAt: session.updatedAt ? new Date(session.updatedAt) : undefined
          }));
          setSessions(convertedSessions);
          // Set most recent as current if none is set
          if (convertedSessions.length > 0 && !currentSession) {
            const firstSession = convertedSessions[0];
            if (firstSession) {
              setCurrentSession(firstSession);
            }
          }
        } catch (error) {
          debugError('Error parsing local sessions:', error);
        }
      }
      return;
    }

    setIsLoading(true);
    try {
      debugLog('Loading sessions from Supabase for user:', user.id);
      
      // Load from Supabase for authenticated users (primary source)
      // Load both owned sessions and multiplayer sessions the user participates in
      // IMPORTANT: Filter out soft-deleted sessions
      const { data: ownedSessions, error: ownedError } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (ownedError) throw ownedError;

      // Load multiplayer sessions the user participates in but doesn't own
      // First get the session IDs where user is a participant
      const { data: participantData, error: participantError } = await supabase
        .from('session_participants')
        .select('session_id')
        .eq('user_id', user.id);

      let participatedSessions = null;
      let participatedError = null;

      if (!participantError && participantData && participantData.length > 0) {
        const sessionIds = participantData.map(p => p.session_id);
        
        // Then get the actual sessions
        const result = await supabase
          .from('sessions')
          .select('*')
          .neq('user_id', user.id)
          .in('id', sessionIds)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false });
          
        participatedSessions = result.data;
        participatedError = result.error;
      }

      if (participatedError && participatedError.message !== 'No rows returned') {
        debugError('Error loading participated sessions:', participatedError);
        // Continue without participated sessions
      }

      const allSessionsData = [
        ...(ownedSessions ?? []),
        ...(participatedSessions ?? [])
      ];

      const cloudSessions: Session[] = allSessionsData.map(session => ({
        id: session.id,
        name: session.name ?? session.title ?? 'Unnamed Session',
        messages: ((session.messages as unknown as RawMessage[]) ?? []).map((msg) => ({
          ...msg,
          timestamp: new Date(msg.timestamp) // Convert string timestamps back to Date objects
        })) ?? [],
        customPrompt: session.custom_prompt ?? '',
        createdAt: new Date(session.created_at),
        updatedAt: new Date(session.updated_at),
        isSynced: true,
        isMultiplayer: session.is_multiplayer ?? false
      })) ?? [];

      debugLog('Loaded sessions from Supabase:', cloudSessions.length);
      setSessions(cloudSessions);

      // Restore current session from server
      const lastSessionId = localStorage.getItem('lastSessionId');
      if (lastSessionId && cloudSessions.length > 0) {
        const lastSession = cloudSessions.find(s => s.id === lastSessionId);
        if (lastSession) {
          debugLog('Restoring last session:', lastSession.name);
          setCurrentSession(lastSession);
        } else if (cloudSessions.length > 0) {
          // Fallback to most recent session
          debugLog('Last session not found, using most recent');
          const firstSession = cloudSessions[0];
          if (firstSession) {
            setCurrentSession(firstSession);
          }
        }
      } else if (cloudSessions.length > 0) {
        // No last session saved, use most recent
        debugLog('No last session ID, using most recent');
        const firstSession = cloudSessions[0];
        if (firstSession) {
          setCurrentSession(firstSession);
        }
      }

      // Check for any local sessions that might need migration
      const localSessions = localStorage.getItem('dnd-sessions');
      if (localSessions) {
        try {
          const localParsed: Session[] = JSON.parse(localSessions);
          // Convert timestamps for local sessions before comparison
          const convertedLocalSessions = (localParsed as unknown as RawSession[]).map((session) => ({
            ...session,
            messages: session.messages?.map((msg) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            })) ?? [],
            createdAt: new Date(session.createdAt),
            updatedAt: session.updatedAt ? new Date(session.updatedAt) : undefined
          }));
          const unsyncedSessions = convertedLocalSessions.filter(local =>
            !cloudSessions.find(cloud => cloud.id === local.id)
          );

          if (unsyncedSessions.length > 0) {
            debugLog('Found unsynced local sessions, migrating:', unsyncedSessions.length);
            await syncLocalSessions(unsyncedSessions);
          }
        } catch (error) {
          debugError('Error checking local sessions for migration:', error);
        }
      }

    } catch (error) {
      debugError('Error loading sessions from Supabase:', error);
      toast({
        title: "Session Load Error",
        description: "Could not load your saved adventures from the server. Please try refreshing.",
        variant: "destructive",
      });
      
      // Fallback to localStorage if Supabase fails
      const localSessions = localStorage.getItem('dnd-sessions');
      if (localSessions) {
        try {
          const parsed = JSON.parse(localSessions);
          // Convert timestamp strings back to Date objects for localStorage fallback
          const convertedSessions = (parsed as RawSession[]).map((s) => ({
            ...s,
            messages: s.messages?.map((msg) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            })) ?? [],
            createdAt: new Date(s.createdAt),
            updatedAt: s.updatedAt ? new Date(s.updatedAt) : undefined,
            isSynced: false
          }));
          setSessions(convertedSessions);
        } catch (error) {
          debugError('Error parsing local sessions fallback:', error);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, currentSession, toast]);

  // Sync local sessions to Supabase
  const syncLocalSessions = async (localSessions: Session[]) => {
    if (!user || localSessions.length === 0) return;

    setIsSyncing(true);
    let syncedCount = 0;

    debugLog('Syncing local sessions to Supabase:', localSessions.length);

    for (const session of localSessions) {
      try {
        const { error } = await supabase
          .from('sessions')
          .upsert({
            id: session.id,
            user_id: user.id,
            name: session.name,
            title: session.name,
            messages: session.messages.map(msg => ({
              ...msg,
              timestamp: msg.timestamp.toISOString()
            })) as unknown as Json,
            custom_prompt: session.customPrompt,
            created_at: session.createdAt.toISOString(),
            updated_at: new Date().toISOString(),
            world: 1, // Default world for synced sessions
          });

        if (!error) {
          syncedCount++;
          // Mark as synced
          setSessions(prev => prev.map(s => 
            s.id === session.id ? { ...s, isSynced: true } : s
          ));
        } else {
          debugError(`Error syncing session ${session.name}:`);
        }
      } catch (error) {
        debugError(`Error syncing session ${session.name}:`, error);
      }
    }
    // Remove synced sessions from local cache to prevent re-sync loops
    try {
      const local = localStorage.getItem('dnd-sessions');
      if (local) {
        const list = JSON.parse(local) as Session[];
        const syncedIds = new Set(localSessions.map(s => s.id));
        const remaining = list.filter(s => !syncedIds.has(s.id));
        if (remaining.length === 0) localStorage.removeItem('dnd-sessions');
        else localStorage.setItem('dnd-sessions', JSON.stringify(remaining));
      }
    } catch (error) {
      debugError('Error updating local sessions cache after sync:', error);
    }

    setIsSyncing(false);
    if (syncedCount > 0) {
      debugLog('Successfully synced sessions:', syncedCount);
      toast({
        title: "Adventures Synced",
        description: `${syncedCount} local adventures have been backed up to the server.`,
      });
      
      // Reload sessions to get the latest state
      await loadSessions();
    }
  };

  // Save session to both local storage and Supabase
  const saveSession = useCallback(async (session: Session) => {
    // Skip saving multiplayer sessions unless user is the owner
    if (session.isMultiplayer && user) {
      // For multiplayer sessions, we use RPCs to update messages, not direct saves
      debugLog('Skipping save for multiplayer session (use RPC instead):', session.id);
      return;
    }

    // Update local state first
    const updatedSessions = sessions.map(s => 
      s.id === session.id ? session : s
    );
    setSessions(updatedSessions);

    // Save to Supabase if authenticated (primary storage)
    if (user) {
      try {
        const { error } = await supabase
          .from('sessions')
          .upsert({
            id: session.id,
            user_id: user.id,
            name: session.name,
            title: session.name,
            messages: session.messages.map(msg => ({
              ...msg,
              timestamp: msg.timestamp.toISOString()
            })) as unknown as Json,
            custom_prompt: session.customPrompt,
            updated_at: new Date().toISOString(),
            world: 1, // Default world for saved sessions
          });

        if (error) throw new Error("Operation failed");

        // Mark as synced and only store session ID in localStorage
        setSessions(prev => prev.map(s => 
          s.id === session.id ? { ...s, isSynced: true } : s
        ));
        localStorage.setItem('lastSessionId', session.id);

        // Only show toast for manual saves, not auto-saves
        // (Auto-saves are triggered by useEffect, manual saves are direct calls)

      } catch (error) {
        console.error('Error saving session to cloud:', error);
        // Fallback to localStorage for offline support
        localStorage.setItem('dnd-sessions', JSON.stringify(updatedSessions));
        setSessions(prev => prev.map(s => 
          s.id === session.id ? { ...s, isSynced: false } : s
        ));
      }
    } else {
      // Save to localStorage only for non-authenticated users
      localStorage.setItem('dnd-sessions', JSON.stringify(updatedSessions));
    }
  }, [user, sessions]);

  // Create new session
  const createSession = useCallback((name: string, customPrompt: string) => {
    const newSession: Session = {
      id: crypto.randomUUID(),
      name,
      messages: [],
      customPrompt,
      createdAt: new Date(),
      isSynced: false,
    };

    debugLog('Creating new session:', name);
    
    const updatedSessions = [...sessions, newSession];
    setSessions(updatedSessions);
    setCurrentSession(newSession);
    
    // Save immediately to server (and localStorage as fallback)
    saveSession(newSession);
    
    return newSession;
  }, [sessions, saveSession]);

  // Delete session (soft delete)
  const deleteSession = useCallback(async (sessionId: string) => {
    debugLog('🗑️ SOFT DELETE SESSION START:', sessionId);
    
    // Store current sessions for potential rollback
    const originalSessions = [...sessions];
    
    // Optimistically update local state
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(updatedSessions);
    debugLog('🗑️ Optimistically updated sessions, remaining count:', updatedSessions.length);

    try {
      // Soft delete from Supabase if authenticated
      if (user) {
        debugLog('🗑️ Soft deleting from Supabase for user:', user.id);
        const { error } = await supabase
          .from('sessions')
          .update({
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId)
          .eq('user_id', user.id);

        if (error) {
          debugError('🗑️ Supabase soft delete error:');
          throw new Error("Operation failed");
        }
        
        debugLog('🗑️ Successfully soft deleted from Supabase');
        
        // Prune deleted session from any local cache to avoid re-syncing
        try {
          const local = localStorage.getItem('dnd-sessions');
          if (local) {
            const list = JSON.parse(local) as Session[];
            const pruned = list.filter(s => s.id !== sessionId);
            if (pruned.length === 0) localStorage.removeItem('dnd-sessions');
            else localStorage.setItem('dnd-sessions', JSON.stringify(pruned));
          }
            } catch (error) {
      debugError('Error pruning local sessions cache:', error);
        }
        
        // Clean up localStorage reference
        if (localStorage.getItem('lastSessionId') === sessionId) {
          localStorage.removeItem('lastSessionId');
          debugLog('🗑️ Removed lastSessionId from localStorage');
        }
        
        toast({
          title: "Adventure Deleted",
          description: "Your adventure has been successfully deleted.",
        });
        
      } else {
        // Update localStorage for non-authenticated users
        localStorage.setItem('dnd-sessions', JSON.stringify(updatedSessions));
        debugLog('🗑️ Updated localStorage for non-authenticated user');
        
        toast({
          title: "Adventure Deleted",
          description: "Your adventure has been successfully deleted.",
        });
      }
      
    } catch {
      debugError('🗑️ Error deleting session:');
      
      // Rollback the optimistic update
      setSessions(originalSessions);
      debugLog('🗑️ Rolled back sessions due to error');
      
      // Error toast
      toast({
        title: "Delete Failed",
        description: "Failed to delete session. Please try again.",
        variant: "destructive",
      });
      
      throw new Error("Operation failed"); // Re-throw for caller handling
    }

    // Clear current session if it was deleted
    if (currentSession?.id === sessionId) {
      debugLog('🗑️ Clearing current session since it was deleted');
      setCurrentSession(null);
    }
    
    debugLog('🗑️ DELETE SESSION COMPLETE');
  }, [sessions, currentSession, user, toast]);

  // Export session
  const exportSession = useCallback((session: Session) => {
    const sessionData = {
      session,
      exportedAt: new Date(),
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(sessionData, null, 2)], {
      type: 'application/json',
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dnd-session-${session.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // Enhanced import session with better ChatGPT support and error handling
  const importSession = useCallback((file: File): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      debugLog('🔄 IMPORT SESSION START:', file.name);
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const rawData = e.target?.result as string;
          let data: unknown;
          
          try {
            data = JSON.parse(rawData);
          } catch (parseError) {
            reject(new Error('Invalid JSON file. Please ensure the file is properly formatted.'));
            return;
          }

          if (typeof data !== 'object' || !data) {
            reject(new Error('Invalid file format: expected JSON object'));
            return;
          }

          const dataObj = data as Record<string, unknown>;
          
          let importedSession: Session;
          let messageCount = 0;
          
          // Handle our exported format
          if ('session' in dataObj && 'version' in dataObj) {
            debugLog('🔄 Detected native export format');
            const sessionData = dataObj.session as Record<string, unknown>;
            importedSession = {
              id: crypto.randomUUID(),
              name: sessionData.name as string,
              customPrompt: sessionData.customPrompt as string,
              messages: (sessionData.messages as unknown[])?.map((msg) => ({
                id: (msg as Record<string, unknown>).id as string ?? crypto.randomUUID(),
                role: (msg as Record<string, unknown>).role as 'user' | 'assistant',
                content: (msg as Record<string, unknown>).content as string,
                imageUrl: (msg as Record<string, unknown>).imageUrl as string | undefined,
                audioUrl: (msg as Record<string, unknown>).audioUrl as string | undefined,
                videoUrl: (msg as Record<string, unknown>).videoUrl as string | undefined,
                videoTaskId: (msg as Record<string, unknown>).videoTaskId as string | undefined,
                isGeneratingAudio: (msg as Record<string, unknown>).isGeneratingAudio as boolean | undefined,
                ttsError: (msg as Record<string, unknown>).ttsError as string | undefined,
                timestamp: new Date((msg as Record<string, unknown>).timestamp as string)
              })) ?? [],
              createdAt: new Date(),
              updatedAt: sessionData.updatedAt ? new Date(sessionData.updatedAt as string) : undefined,
              isSynced: false
            } as Session;
            messageCount = importedSession.messages.length;
          }
          // Enhanced ChatGPT conversation format handling
          else if ('mapping' in dataObj || 'title' in dataObj || 'conversation_id' in dataObj) {
            debugLog('🔄 Detected ChatGPT format with mapping');
            const messages: Message[] = [];
            const conversationTitle = (dataObj.title as string) ?? "Imported ChatGPT Conversation";
            
            // Handle ChatGPT's mapping format (most common export format)
            if ('mapping' in dataObj && dataObj.mapping) {
              const mapping = dataObj.mapping as Record<string, ChatGPTNode>;
              const sortedNodes = Object.values(mapping)
                .filter((node): node is ChatGPTNode & { message: ChatGPTMessage } => {
                  return Boolean(node.message?.content?.parts);
                })
                .sort((a, b) => {
                  const timeA = a.message.create_time ?? 0;
                  const timeB = b.message.create_time ?? 0;
                  return timeA - timeB;
                });
              
              sortedNodes.forEach((node) => {
                const { message } = node;
                const content = message.content.parts
                  .filter((part): part is string => typeof part === 'string' && Boolean(part.trim()))
                  .join(' ')
                  .trim();
                    
                if (content) {
                  const role = (message.author.role === 'assistant' ? 'assistant' : 'user');
                  const timestamp = new Date(message.create_time * 1000);
                      
                  messages.push({
                    id: crypto.randomUUID(),
                    role,
                    content,
                    timestamp
                  });
                }
              });
            }
            
            importedSession = {
              id: crypto.randomUUID(),
              name: conversationTitle,
              messages,
              customPrompt: '',
              createdAt: new Date(),
              isSynced: false
            };
            messageCount = messages.length;
          }
          // Handle conversations.json format (multiple conversations)
          else if (Array.isArray(dataObj) && dataObj.some(item => 
            typeof item === 'object' && item && ('mapping' in item || 'title' in item)
          )) {
            debugLog('🔄 Detected conversations.json format');
            const firstConversation = dataObj[0] as Record<string, unknown>;
            
            if ('mapping' in firstConversation && firstConversation.mapping) {
              const messages: Message[] = [];
              const mapping = firstConversation.mapping as Record<string, ChatGPTNode>;
              const sortedNodes = Object.values(mapping)
                .filter((node): node is ChatGPTNode & { message: ChatGPTMessage } => {
                  return Boolean(node.message?.content?.parts);
                })
                .sort((a, b) => (a.message.create_time ?? 0) - (b.message.create_time ?? 0));
                
              sortedNodes.forEach((node) => {
                const { message } = node;
                const content = message.content.parts
                  .filter((part): part is string => typeof part === 'string' && Boolean(part.trim()))
                  .join(' ')
                  .trim();
                if (content) {
                  messages.push({
                    id: crypto.randomUUID(),
                    role: (message.author.role === 'assistant' ? 'assistant' : 'user'),
                    content,
                    timestamp: new Date(message.create_time * 1000)
                  });
                }
              });
              
              importedSession = {
                id: crypto.randomUUID(),
                name: (firstConversation.title as string) ?? "Imported ChatGPT Conversation",
                messages,
                customPrompt: '',
                createdAt: new Date(),
                isSynced: false
              };
              messageCount = messages.length;
            } else {
              reject(new Error('No valid conversation data found in the file.'));
              return;
            }
          }
          // Handle simple message array format
          else if (Array.isArray(dataObj)) {
            debugLog('🔄 Detected simple array format');
            const messages: Message[] = [];
            
            dataObj.forEach((item: unknown) => {
              if (typeof item !== 'object' || !item) return;
              const messageItem = item as Record<string, unknown>;
              if (messageItem.content || messageItem.message || messageItem.text) {
                messages.push({
                  id: crypto.randomUUID(),
                  role: ((messageItem.role as string) === 'assistant' ? 'assistant' : 'user'),
                  content: (messageItem.content ?? messageItem.message ?? messageItem.text ?? '') as string,
                  timestamp: new Date((messageItem.timestamp ?? messageItem.created_at ?? Date.now()) as number | string)
                });
              }
            });
            
            importedSession = {
              id: crypto.randomUUID(),
              name: "Imported Session",
              messages,
              customPrompt: '',
              createdAt: new Date(),
              isSynced: false
            };
            messageCount = messages.length;
          }
          // Handle generic object with messages array
          else if ('messages' in dataObj || 'conversation' in dataObj) {
            debugLog('🔄 Detected generic format with messages');
            const messagesArray = ((dataObj.messages ?? dataObj.conversation) ?? []) as unknown[];
            const messages: Message[] = messagesArray
              .map((msg: unknown) => {
                if (typeof msg !== 'object' || !msg) {
                  return null;
                }
                const messageItem = msg as Record<string, unknown>;
                const role = ((messageItem.role as string) === 'assistant' ? 'assistant' : 'user');
                const content = (messageItem.content ?? messageItem.text ?? messageItem.message ?? '') as string;
                const timestamp = new Date((messageItem.timestamp ?? messageItem.created_at ?? Date.now()) as number | string);
                return {
                  id: crypto.randomUUID(),
                  role,
                  content,
                  timestamp
                } as Message;
              })
              .filter((msg): msg is Message => msg !== null);
            
            importedSession = {
              id: crypto.randomUUID(),
              name: (dataObj.name as string) ?? (dataObj.title as string) ?? "Imported Session",
              messages,
              customPrompt: (dataObj.customPrompt ?? dataObj.system_prompt ?? dataObj.prompt ?? '') as string,
              createdAt: new Date(),
              isSynced: false
            };
            messageCount = messages.length;
          }
          else {
            debugError('🔄 Unsupported file format:', dataObj);
            reject(new Error('Unsupported file format. Please check that your file contains conversation data in a supported format (ChatGPT export, conversations.json, or message arrays).'));
            return;
          }
          
          if (messageCount === 0) {
            reject(new Error('No messages found in the imported file. Please ensure the file contains conversation data.'));
            return;
          }
          
          debugLog('🔄 Successfully parsed session:', importedSession.name, 'with', messageCount, 'messages');
          
          // Add to sessions and set as current
          const updatedSessions = [...sessions, importedSession];
          setSessions(updatedSessions);
          setCurrentSession(importedSession);
          
          // Save to storage
          await saveSession(importedSession);
          
          debugLog('🔄 IMPORT SESSION COMPLETE');
          
          // Enhanced success notification
          toast({
            title: "🎉 Import Successful!",
            description: `"${importedSession.name}" with ${messageCount} messages is now ready to continue your adventure.`,
            duration: 5000,
          });
          
          resolve();
        } catch (error) {
          debugError('🔄 Import error:', error);
          reject(new Error(`Failed to import session: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      };
      reader.readAsText(file);
    });
  }, [sessions, saveSession, toast]);

  // Load sessions when user changes or component mounts
  useEffect(() => {
    debugLog('useSessionManager: User changed, loading sessions. User ID:', user?.id);
    loadSessions();
  }, [user?.id]); // Only depend on user.id to prevent infinite loops

  // Clear all sessions for current user (cloud + local)
  const clearAllSessions = useCallback(async () => {
    try {
      debugLog('🧹 Clearing all adventures for current user');

      // Optimistically clear local state
      setSessions([]);
      setCurrentSession(null);

      if (user) {
        const nowIso = new Date().toISOString();
        await Promise.allSettled([
          // Soft-delete all sessions owned by the user
          supabase
            .from('sessions')
            .update({ deleted_at: nowIso, updated_at: nowIso })
            .eq('user_id', user.id)
            .is('deleted_at', null),
          // Leave all multiplayer sessions
          supabase
            .from('session_participants')
            .delete()
            .eq('user_id', user.id)
        ]);
      }

      // Clear local storage caches to avoid re-sync loops
      localStorage.removeItem('dnd-sessions');
      localStorage.removeItem('lastSessionId');
      localStorage.removeItem('multiplayerRoomId');

      toast({
        title: 'All Adventures Cleared',
        description: 'Your adventures have been removed from cloud and local cache.',
      });
    } catch (error) {
      debugError('🧹 Error clearing adventures:', error);
      toast({
        title: 'Clear Failed',
        description: 'Could not clear all adventures. Please try again.',
        variant: 'destructive',
      });
    }
  }, [user, toast]);

  // Auto-save current session with debouncing
  useEffect(() => {
    if (!currentSession || !user || currentSession.isSynced !== false) return;

    // Debounce auto-save to avoid excessive API calls
    const timeoutId = setTimeout(() => {
      debugLog('Auto-saving current session:', currentSession.name);
      saveSession(currentSession).catch(debugError);
    }, 5000); // 5 seconds debounce

    return () => clearTimeout(timeoutId);
  }, [currentSession?.messages?.length, currentSession?.customPrompt, user, saveSession]); // Only trigger on content changes

  return {
    sessions,
    currentSession,
    setCurrentSession: useCallback((sessionOrUpdater: Session | null | ((prev: Session | null) => Session | null)) => {
      if (typeof sessionOrUpdater === 'function') {
        setCurrentSession(prev => {
          const newSession = sessionOrUpdater(prev);
          debugLog('Setting current session (functional):', newSession?.name ?? 'null');
          // Save the session ID for restoration on next login
          if (newSession && user) {
            localStorage.setItem('lastSessionId', newSession.id);
          }
          return newSession;
        });
      } else {
        debugLog('Setting current session:', sessionOrUpdater?.name ?? 'null');
        setCurrentSession(sessionOrUpdater);
        // Save the session ID for restoration on next login
        if (sessionOrUpdater && user) {
          localStorage.setItem('lastSessionId', sessionOrUpdater.id);
        }
      }
    }, [user]),
    isLoading,
    isSyncing,
    createSession,
    saveSession,
    deleteSession,
    exportSession,
    importSession,
    loadSessions,
    clearAllSessions,
    runDiagnostics: _runDiagnostics
  };
};