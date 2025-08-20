import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useRetry } from '@/hooks/useRetry';
import { debugLog, debugError } from '@/lib/debug';
import { useRealtimeManager, SubscriptionConfig } from '@/hooks/useRealtimeManager';
import { useChatDiagnostics } from '@/hooks/useChatDiagnostics';
import { debounce } from '@/lib/performance-monitor';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  videoTaskId?: string;
  isGeneratingAudio?: boolean;
  ttsError?: string;
}

export interface Session {
  id: string;
  name: string;
  messages: Message[];
  customPrompt: string;
  createdAt: Date;
  updatedAt?: Date;
  isSynced?: boolean;
  isMultiplayer?: boolean;
}

export const useSessionManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { handleError, handleSuccess } = useErrorHandler();
  const { runDiagnostics } = useChatDiagnostics();
  
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
      callback: (payload) => {
        debugLog('Session participant INSERT - reloading sessions');
        debouncedLoadSessions();
      }
    },
    {
      table: 'session_participants',
      event: 'DELETE',
      filter: `user_id=eq.${user.id}`,
      callback: (payload) => {
        debugLog('Session participant DELETE - reloading sessions');
        debouncedLoadSessions();
      }
    },
    {
      table: 'session_participants',
      event: 'UPDATE',
      filter: `user_id=eq.${user.id}`,
      callback: (payload) => {
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
          const convertedSessions = parsed.map((session: any) => ({
            ...session,
            messages: session.messages?.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            })) || [],
            createdAt: new Date(session.createdAt),
            updatedAt: session.updatedAt ? new Date(session.updatedAt) : undefined
          }));
          setSessions(convertedSessions);
          // Set most recent as current if none is set
          if (convertedSessions.length > 0 && !currentSession) {
            setCurrentSession(convertedSessions[0]);
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
        ...(ownedSessions || []),
        ...(participatedSessions || [])
      ];

      const cloudSessions: Session[] = allSessionsData.map(session => ({
        id: session.id,
        name: session.name || session.title || 'Unnamed Session',
        messages: (session.messages as any[])?.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp) // Convert string timestamps back to Date objects
        })) || [],
        customPrompt: session.custom_prompt || '',
        createdAt: new Date(session.created_at),
        updatedAt: new Date(session.updated_at),
        isSynced: true,
        isMultiplayer: session.is_multiplayer || false
      })) || [];

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
          setCurrentSession(cloudSessions[0]);
        }
      } else if (cloudSessions.length > 0) {
        // No last session saved, use most recent
        debugLog('No last session ID, using most recent');
        setCurrentSession(cloudSessions[0]);
      }

      // Check for any local sessions that might need migration
      const localSessions = localStorage.getItem('dnd-sessions');
      if (localSessions) {
        try {
          const localParsed: Session[] = JSON.parse(localSessions);
          // Convert timestamps for local sessions before comparison
          const convertedLocalSessions = localParsed.map((session: any) => ({
            ...session,
            messages: session.messages?.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            })) || [],
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
          const convertedSessions = parsed.map((s: any) => ({
            ...s,
            messages: s.messages?.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            })) || [],
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
            messages: session.messages as any,
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
          debugError(`Error syncing session ${session.name}:`, error);
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
    } catch (e) {
      debugError('Error updating local sessions cache after sync:', e);
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
            messages: session.messages as any,
            custom_prompt: session.customPrompt,
            updated_at: new Date().toISOString(),
            world: 1, // Default world for saved sessions
          });

        if (error) throw error;

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
          debugError('🗑️ Supabase soft delete error:', error);
          throw error;
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
        } catch (e) {
          debugError('Error pruning local sessions cache:', e);
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
      
    } catch (error) {
      debugError('🗑️ Error deleting session:', error);
      
      // Rollback the optimistic update
      setSessions(originalSessions);
      debugLog('🗑️ Rolled back sessions due to error');
      
      // Error toast
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete session. Please try again.",
        variant: "destructive",
      });
      
      throw error; // Re-throw for caller handling
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
    return new Promise((resolve, reject) => {
      debugLog('🔄 IMPORT SESSION START:', file.name);
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const rawData = e.target?.result as string;
          let data;
          
          try {
            data = JSON.parse(rawData);
          } catch (parseError) {
            reject(new Error('Invalid JSON file. Please ensure the file is properly formatted.'));
            return;
          }
          
          let importedSession: Session;
          let messageCount = 0;
          
          // Handle our exported format
          if (data.session && data.version) {
            debugLog('🔄 Detected native export format');
            importedSession = {
              ...data.session,
              id: crypto.randomUUID(),
              messages: data.session.messages?.map((msg: any) => ({
                ...msg,
                id: msg.id || crypto.randomUUID(),
                timestamp: new Date(msg.timestamp)
              })) || [],
              createdAt: new Date(),
              updatedAt: data.session.updatedAt ? new Date(data.session.updatedAt) : undefined,
              isSynced: false
            };
            messageCount = importedSession.messages.length;
          }
          // Enhanced ChatGPT conversation format handling
          else if (data.mapping || data.title || data.conversation_id) {
            debugLog('🔄 Detected ChatGPT format with mapping');
            const messages: Message[] = [];
            const conversationTitle = data.title || "Imported ChatGPT Conversation";
            
            // Handle ChatGPT's mapping format (most common export format)
            if (data.mapping) {
              const sortedNodes = Object.values(data.mapping)
                .filter((node: any) => node.message?.content?.parts)
                .sort((a: any, b: any) => {
                  const timeA = a.message.create_time || 0;
                  const timeB = b.message.create_time || 0;
                  return timeA - timeB;
                });
              
              sortedNodes.forEach((node: any) => {
                const message = node.message;
                if (message.content.parts && message.content.parts.length > 0) {
                  const content = message.content.parts
                    .filter((part: any) => typeof part === 'string' && part.trim())
                    .join(' ')
                    .trim();
                    
                  if (content) {
                    const role = message.author?.role === 'assistant' ? 'assistant' : 'user';
                    const timestamp = message.create_time 
                      ? new Date(message.create_time * 1000) 
                      : new Date();
                      
                    messages.push({
                      id: crypto.randomUUID(),
                      role,
                      content,
                      timestamp
                    });
                  }
                }
              });
            }
            
            importedSession = {
              id: crypto.randomUUID(),
              name: conversationTitle,
              messages: messages,
              customPrompt: '',
              createdAt: new Date(),
              isSynced: false
            };
            messageCount = messages.length;
          }
          // Handle conversations.json format (multiple conversations)
          else if (Array.isArray(data) && data.some(item => item.mapping || item.title)) {
            debugLog('🔄 Detected conversations.json format');
            const firstConversation = data[0];
            
            if (firstConversation.mapping) {
              const messages: Message[] = [];
              const sortedNodes = Object.values(firstConversation.mapping)
                .filter((node: any) => node.message?.content?.parts)
                .sort((a: any, b: any) => (a.message.create_time || 0) - (b.message.create_time || 0));
                
              sortedNodes.forEach((node: any) => {
                const content = node.message.content.parts.join(' ').trim();
                if (content) {
                  messages.push({
                    id: crypto.randomUUID(),
                    role: node.message.author?.role === 'assistant' ? 'assistant' : 'user',
                    content,
                    timestamp: new Date(node.message.create_time * 1000 || Date.now())
                  });
                }
              });
              
              importedSession = {
                id: crypto.randomUUID(),
                name: firstConversation.title || "Imported ChatGPT Conversation",
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
          else if (Array.isArray(data)) {
            debugLog('🔄 Detected simple array format');
            const messages: Message[] = [];
            
            data.forEach((item: any, index: number) => {
              if (item.content || item.message || item.text) {
                messages.push({
                  id: crypto.randomUUID(),
                  role: item.role || (index % 2 === 0 ? 'user' : 'assistant'),
                  content: item.content || item.message || item.text || '',
                  timestamp: new Date(item.timestamp || item.created_at || Date.now())
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
          else if (data.messages || data.conversation) {
            debugLog('🔄 Detected generic format with messages');
            const messagesArray = data.messages || data.conversation || [];
            const messages: Message[] = messagesArray.map((msg: any) => ({
              id: crypto.randomUUID(),
              role: msg.role || (msg.type === 'human' ? 'user' : 'assistant') || 'user',
              content: msg.content || msg.text || msg.message || '',
              timestamp: new Date(msg.timestamp || msg.created_at || Date.now())
            }));
            
            importedSession = {
              id: crypto.randomUUID(),
              name: data.name || data.title || "Imported Session",
              messages,
              customPrompt: data.customPrompt || data.system_prompt || data.prompt || '',
              createdAt: new Date(),
              isSynced: false
            };
            messageCount = messages.length;
          }
          else {
            debugError('🔄 Unsupported file format:', data);
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
          debugLog('Setting current session (functional):', newSession?.name || 'null');
          // Save the session ID for restoration on next login
          if (newSession && user) {
            localStorage.setItem('lastSessionId', newSession.id);
          }
          return newSession;
        });
      } else {
        debugLog('Setting current session:', sessionOrUpdater?.name || 'null');
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
    runDiagnostics
  };
};