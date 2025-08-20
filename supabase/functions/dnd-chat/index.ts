import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('DnD Chat function called at:', new Date().toISOString())
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { messages, customPrompt } = await req.json()
    console.log('Received request with', messages.length, 'messages')
    
    // Get and validate the API key
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    
    if (!apiKey) {
      console.error('OpenAI API key not configured')
      throw new Error('OpenAI API key is not configured. Please set the OPENAI_API_KEY secret in Supabase.')
    }
    
    if (!apiKey.startsWith('sk-')) {
      console.error('Invalid OpenAI API key format')
      throw new Error('Invalid OpenAI API key format. It should start with sk-')
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
Be fair, consistent, and immersive. Never forget key events or rolls. Let the rules and the story feed each other so it feels like a living, breathing world.`}`

    console.log('Making request to OpenAI API...')
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
    })

    console.log('OpenAI API response status:', response.status)
    const data = await response.json()
    
    if (!response.ok) {
      console.error('OpenAI API Error Response:', data)
      throw new Error(data.error?.message || `OpenAI API error: ${response.status}`)
    }

    console.log('Successfully generated response, returning to client')
    return new Response(
      JSON.stringify({ 
        content: data.choices[0].message.content,
        usage: data.usage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Edge Function Error Details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    })
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An error occurred while processing your request',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})