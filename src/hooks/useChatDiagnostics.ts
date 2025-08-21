import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { debugLog, debugError } from '@/lib/debug';
import { useToast } from '@/hooks/use-toast';

interface DiagnosticResults {
  database: { connected: boolean; error?: string };
  realtime: { connected: boolean; error?: string };
  session?: { accessible: boolean; error?: string };
  multiplayer?: { accessible: boolean; error?: string };
  edgeFunction: { available: boolean; error?: string };
}

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
      results: {} as DiagnosticResults
    };

    try {
      // Test 1: Database connectivity
      debugLog('🔍 Testing database connectivity...');
      const { error: dbError } = await supabase
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
        const { error: functionError } = await supabase.functions
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
      } catch (error: unknown) {
        diagnostics.results.edgeFunction = {
          available: false,
          error: error instanceof Error ? error.message : 'Function invocation failed'
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

    } catch (error: unknown) {
      debugError('🔍 Diagnostics failed:', error instanceof Error ? error.message : String(error));
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
