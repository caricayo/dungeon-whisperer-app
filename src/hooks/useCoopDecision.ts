import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { debugLog, debugError } from '@/lib/debug';

export interface CoopPresence {
  user_id: string;
  username: string;
  action?: string;
  ready?: boolean;
}

export const useCoopDecision = (sessionId?: string | null) => {
  const { user } = useAuth();
  const [myAction, setMyAction] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [peers, setPeers] = useState<CoopPresence[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Setup presence channel per-session
  useEffect(() => {
    if (!user || !sessionId) return;

    const channel = supabase.channel(`coop-${sessionId}`, {
      config: {
        presence: { key: user.id },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const flat = (Object.values(state).flat() as unknown as any[])
          .filter((p: any) => p?.user_id)
          .map((p: any) => ({
            user_id: p.user_id,
            username: p.username,
            action: p.action,
            ready: p.ready,
          })) as CoopPresence[];
        setPeers(flat);
        debugLog('Coop sync', flat);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        const valid = (newPresences as unknown as any[])
          .filter((p: any) => p?.user_id)
          .map((p: any) => ({
            user_id: p.user_id,
            username: p.username,
            action: p.action,
            ready: p.ready,
          })) as CoopPresence[];
        setPeers((prev) => {
          const others = prev.filter((p) => !valid.find((v) => v.user_id === p.user_id));
          return [...others, ...valid];
        });
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setPeers((prev) => prev.filter((p) => p.user_id !== key));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            username: user.user_metadata?.username || user.email?.split('@')[0] || 'Player',
            action: '',
            ready: false,
          } satisfies CoopPresence);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setPeers([]);
      setMyAction('');
      setIsReady(false);
    };
  }, [user, sessionId]);

  // Update my presence when action/ready changes
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !user) return;
    channel.track({
      user_id: user.id,
      username: user.user_metadata?.username || user.email?.split('@')[0] || 'Player',
      action: myAction,
      ready: isReady,
    } as CoopPresence).catch((e) => debugError('Presence track failed', e));
  }, [myAction, isReady, user]);

  const setAction = useCallback((text: string) => setMyAction(text), []);
  const toggleReady = useCallback(() => setIsReady((r) => !r), []);
  const reset = useCallback(() => {
    setMyAction('');
    setIsReady(false);
  }, []);

  // Build combined prompt when all ready and have actions
  const allPresences = useMemo(() => {
    const me: CoopPresence | null = user
      ? { user_id: user.id, username: user.user_metadata?.username || user.email?.split('@')[0] || 'Player', action: myAction, ready: isReady }
      : null;
    const others = peers.filter((p) => p.user_id !== user?.id);
    return me ? [me, ...others] : others;
  }, [peers, user, myAction, isReady]);

  const everyoneReady = useMemo(() => allPresences.length > 0 && allPresences.every((p) => p.ready && (p.action || '').trim().length > 0), [allPresences]);

  const combinedPrompt = useMemo(() => {
    if (!everyoneReady) return '';
    const parts = allPresences.map((p) => `${p.username}: "${(p.action || '').trim()}"`);
    return `Party actions this turn:\n${parts.join('\n')}\n\nResolve these simultaneous intents fairly, describe outcomes for each, and update the scene.`;
  }, [allPresences, everyoneReady]);

  return {
    myAction,
    isReady,
    peers: allPresences,
    everyoneReady,
    combinedPrompt,
    setAction,
    toggleReady,
    reset,
  };
};
