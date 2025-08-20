import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { 
  createSecureCorsHeaders, 
  validateChatRequest, 
  authenticateRequest, 
  checkRateLimit, 
  createErrorResponse,
  createRateLimitResponse,
  logSecurityEvent,
  sanitizeObject
} from "../_shared/security-utils.ts";

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const origin = req.headers.get('origin');
  const userAgent = req.headers.get('user-agent');
  const corsHeaders = createSecureCorsHeaders(origin);
  
  console.log(`[${requestId}] DnD Chat V2 function called at:`, new Date().toISOString());
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405, corsHeaders);
  }

  try {
    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      await logSecurityEvent(
        supabase,
        'validation_error',
        { functionName: 'dnd-chat-v2', error: 'Invalid JSON body', requestId },
        userAgent
      );
      return createErrorResponse('Invalid JSON in request body', 400, corsHeaders);
    }

    // Validate request structure
    const validation = validateChatRequest(requestBody);
    if (!validation.valid) {
      await logSecurityEvent(
        supabase,
        'validation_error',
        { functionName: 'dnd-chat-v2', error: validation.error, requestId },
        userAgent
      );
      return createErrorResponse(validation.error!, 400, corsHeaders);
    }

    const { messages, customPrompt, metadata, demoMode } = requestBody;
    console.log(`[${requestId}] Received request with`, messages.length, 'messages');
    
    // Demo mode guard - reject AI operations in demo mode
    if (demoMode === true) {
      console.log('Demo mode request blocked');
      return new Response(
        JSON.stringify({ 
          error: 'Demo Mode Active',
          details: 'AI features are disabled in demo mode. Upgrade to unlock all capabilities.',
          demoMode: true
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }
    
    // Authenticate request
    const authHeader = req.headers.get('Authorization');
    const { user, error: authError } = await authenticateRequest(supabase, authHeader);
    
    if (authError) {
      await logSecurityEvent(
        supabase,
        'auth_failure',
        { functionName: 'dnd-chat-v2', error: authError, requestId },
        userAgent
      );
      return createErrorResponse('Authentication required', 401, corsHeaders);
    }

    // Rate limiting check
    const rateLimitCheck = await checkRateLimit(supabase, user.id, 'dnd-chat-v2', 30, 15); // 30 requests per 15 minutes
    if (!rateLimitCheck.allowed) {
      await logSecurityEvent(
        supabase,
        'rate_limit',
        { functionName: 'dnd-chat-v2', userId: user.id, requestId },
        userAgent
      );
      return createRateLimitResponse(corsHeaders);
    }
    
    // Get and validate the API key
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!apiKey) {
      console.error('OpenAI API key not configured');
      throw new Error('OpenAI API key is not configured. Please set the OPENAI_API_KEY secret in Supabase.');
    }
    
    if (!apiKey.startsWith('sk-')) {
      console.error('Invalid OpenAI API key format');
      throw new Error('Invalid OpenAI API key format. It should start with sk-');
    }
    
    // System prompt for D&D Game Master
    const systemPrompt = `${customPrompt || `You are the Dungeon Master for an ongoing 5th Edition Dungeons & Dragons campaign. 
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
Be fair, consistent, and immersive. Never forget key events or rolls. Let the rules and the story feed each other so it feels like a living, breathing world.`}`;

    console.log('Making request to OpenAI API...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.8,
        max_tokens: 500,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      }),
    });

    console.log('OpenAI API response status:', response.status);
    const data = await response.json();
    
    if (!response.ok) {
      console.error('OpenAI API Error Response:', data);
      throw new Error(data.error?.message || `OpenAI API error: ${response.status}`);
    }

    // Log API usage with enhanced metadata
    try {
      await supabase
        .from('api_usage')
        .insert({
          user_id: user.id,
          service: 'openai',
          operation: 'chat_completion',
          endpoint: 'dnd-chat-v2',
          tokens_used: data.usage?.total_tokens || 0,
          cost_estimate: (data.usage?.total_tokens || 0) * 0.0001, // Rough cost estimation
          response_time_ms: Date.now() - parseInt(requestId.split('-')[0], 16), // Approximate timing
          session_id: metadata?.sessionId,
          demo_mode_blocked: false
        });
    } catch (usageError) {
      console.warn(`[${requestId}] Failed to log API usage:`, usageError);
    }

    console.log(`[${requestId}] Successfully generated response, returning to client`);
    return new Response(
      JSON.stringify({ 
        content: data.choices[0].message.content,
        usage: data.usage,
        requestId
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        },
      },
    );
  } catch (error) {
    const errorId = crypto.randomUUID();
    console.error(`[${requestId}] Edge Function Error [${errorId}]:`, {
      name: error.name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Log security event for error tracking
    await logSecurityEvent(
      supabase,
      'suspicious_activity',
      { 
        functionName: 'dnd-chat-v2', 
        errorType: error.name || 'UnknownError',
        errorId,
        requestId 
      },
      userAgent
    );
    
    // Return sanitized error response
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: 'An error occurred while processing your request. Please try again.',
        timestamp: new Date().toISOString(),
        requestId,
        errorId
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          'X-Error-ID': errorId
        },
      },
    );
  }
});