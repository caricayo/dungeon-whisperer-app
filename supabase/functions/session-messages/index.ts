import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    // Get auth user
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const sessionId = url.pathname.split('/')[2]; // Extract session ID from path
    
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is participant in session
    const { data: participant, error: participantError } = await supabaseClient
      .from('session_participants')
      .select('role')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single();

    const { data: session, error: sessionError } = await supabaseClient
      .from('sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single();

    // Check if user is owner or participant
    const isOwner = session?.user_id === user.id;
    const isParticipant = participant !== null;
    
    if (!isOwner && !isParticipant) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'GET') {
      // Get messages with pagination
      const beforeCursor = url.searchParams.get('before');
      const sinceCursor = url.searchParams.get('since');
      const limit = parseInt(url.searchParams.get('limit') || '30');

      console.log('Fetching messages:', { sessionId, beforeCursor, sinceCursor, limit });

      // Get session with messages
      const { data: sessionData, error } = await supabaseClient
        .from('sessions')
        .select('messages, name')
        .eq('id', sessionId)
        .single();

      if (error) {
        console.error('Error fetching session:', error);
        return new Response(
          JSON.stringify({ error: 'Session not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let messages = (sessionData.messages as any[]) || [];
      console.log('Total messages in session:', messages.length);

      // Apply cursor-based filtering
      if (sinceCursor) {
        const sinceDate = new Date(sinceCursor);
        messages = messages.filter(msg => new Date(msg.timestamp) > sinceDate);
        console.log('Messages since cursor:', messages.length);
      }

      if (beforeCursor) {
        const beforeDate = new Date(beforeCursor);
        messages = messages.filter(msg => new Date(msg.timestamp) < beforeDate);
        console.log('Messages before cursor:', messages.length);
      }

      // Sort by timestamp
      messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Apply limit
      if (!sinceCursor) {
        // For initial load (no since), get latest messages
        messages = messages.slice(-limit);
      } else {
        // For delta sync, get all new messages (no limit)
      }

      // Generate next cursors
      const nextCursor = messages.length > 0 ? messages[messages.length - 1].timestamp : null;
      const prevCursor = messages.length > 0 ? messages[0].timestamp : null;

      return new Response(
        JSON.stringify({
          messages,
          nextCursor,
          prevCursor,
          hasMore: sinceCursor ? false : messages.length >= limit,
          sessionName: sessionData.name
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in session-messages function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});