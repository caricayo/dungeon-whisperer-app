import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { debugLog, debugError } from '@/lib/debug';
import { useToast } from '@/hooks/use-toast';

export const useChatDiagnostics = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const runDiagnostics = useCallback(async (sessionId?: string) => {
    if (!user) return;

    debugLog('🔍 CHAT DIAGNOSTICS START');
    const diagnostics = {
      timestamp: new Date().toISOString(),
      userId: user.id,
      sessionId,
      results: {} as any
    };

    try {
      // Test 1: Database connectivity
      debugLog('🔍 Testing database connectivity...');
      const { data: dbTest, error: dbError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      diagnostics.results.database = {
        connected: !dbError,
        error: dbError?.message
      };

      // Test 2: Real-time connection
      debugLog('🔍 Testing real-time connection...');
      const rtStatus = supabase.realtime.isConnected();
      diagnostics.results.realtime = {
        connected: rtStatus,
        channels: supabase.realtime.channels.length
      };

      // Test 3: Session access (if provided)
      if (sessionId) {
        debugLog('🔍 Testing session access...');
        const { data: sessionTest, error: sessionError } = await supabase
          .from('sessions')
          .select('id, name, is_multiplayer')
          .eq('id', sessionId)
          .single();

        diagnostics.results.session = {
          accessible: !sessionError,
          isMultiplayer: sessionTest?.is_multiplayer,
          error: sessionError?.message
        };

        // Test 4: Multiplayer participation (if multiplayer)
        if (sessionTest?.is_multiplayer) {
          debugLog('🔍 Testing multiplayer participation...');
          const { data: participantTest, error: participantError } = await supabase
            .from('session_participants')
            .select('role, permissions')
            .eq('session_id', sessionId)
            .eq('user_id', user.id)
            .single();

          diagnostics.results.multiplayer = {
            isParticipant: !participantError,
            role: participantTest?.role,
            permissions: participantTest?.permissions,
            error: participantError?.message
          };
        }
      }

      // Test 5: Edge function availability
      debugLog('🔍 Testing edge function availability...');
      try {
        const { data: functionTest, error: functionError } = await supabase.functions
          .invoke('dnd-chat-v2', {
            body: { 
              messages: [{ role: 'system', content: 'ping' }], 
              demoMode: true 
            }
          });

        diagnostics.results.edgeFunction = {
          available: !functionError,
          error: functionError?.message
        };
      } catch (error: any) {
        diagnostics.results.edgeFunction = {
          available: false,
          error: error?.message || 'Function invocation failed'
        };
      }

      // Log complete diagnostics
      debugLog('🔍 DIAGNOSTICS COMPLETE:', diagnostics);

      // Show user-friendly summary
      const issues = [];
      if (!diagnostics.results.database.connected) issues.push('Database');
      if (!diagnostics.results.realtime.connected) issues.push('Real-time');
      if (!diagnostics.results.edgeFunction.available) issues.push('AI Chat');
      if (diagnostics.results.session && !diagnostics.results.session.accessible) issues.push('Session');

      if (issues.length === 0) {
        toast({
          title: "All Systems Operational ✅",
          description: "Chat, real-time, and multiplayer systems are working correctly."
        });
      } else {
        toast({
          title: "Issues Detected ⚠️",
          description: `Problems with: ${issues.join(', ')}. Check console for details.`,
          variant: "destructive"
        });
      }

      return diagnostics;

    } catch (error: any) {
      debugError('🔍 Diagnostics failed:', error);
      toast({
        title: "Diagnostics Failed",
        description: "Unable to run system diagnostics. Check console for details.",
        variant: "destructive"
      });
      return null;
    }
  }, [user, toast]);

  return { runDiagnostics };
};