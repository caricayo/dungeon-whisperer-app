import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
)

serve(async (req) => {
  console.log('Image generation function called - Fresh API key reset!')
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, model = 'dall-e-3', size = '1792x1024', quality = 'hd' } = await req.json()
    
    // Extract user ID from Authorization header
    const authHeader = req.headers.get('authorization')
    let userId = null
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '')
        const payload = JSON.parse(atob(token.split('.')[1]))
        userId = payload.sub
      } catch (error) {
        console.warn('Could not extract user ID from token:', error)
      }
    }
    console.log(`Generating image with prompt: "${prompt}", model: ${model}, size: ${size}, quality: ${quality}`)
    
    const enhancedPrompt = `Fantasy D&D artwork: ${prompt}. Detailed medieval fantasy illustration, warm lighting, artistic composition, vibrant colors, high quality fantasy art`
    console.log(`Enhanced prompt: "${enhancedPrompt}"`)
    
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: enhancedPrompt,
        size: size,
        quality: quality,
        n: 1,
      }),
    })

    const data = await response.json()
    console.log(`OpenAI response status: ${response.status}`)
    
    if (!response.ok) {
      console.error('OpenAI API Error:', JSON.stringify(data, null, 2))
      throw new Error(data.error?.message || `OpenAI API error: ${response.status}`)
    }

    // Track API usage if user is authenticated
    if (userId) {
      try {
        await supabase
          .from('api_usage')
          .insert({
            user_id: userId,
            service: 'openai',
            operation: 'image_generation',
            tokens_used: 0, // Images don't use tokens
            cost_estimate: 0.02 // DALL-E 3 HD cost estimate
          })
        console.log('API usage tracked successfully')
      } catch (usageError) {
        console.error('Failed to track API usage:', usageError)
      }
    }

    return new Response(
      JSON.stringify({ 
        imageUrl: data.data[0].url 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Image generation error:', error)
    
    // Determine appropriate status code
    let status = 500;
    let errorMessage = error.message || 'An error occurred while generating the image';
    
    if (error.message?.includes('API key')) {
      status = 401;
    } else if (error.message?.includes('rate limit')) {
      status = 429;
    } else if (error.message?.includes('Invalid request')) {
      status = 400;
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: 'Image generation failed - check logs for details',
        service: 'dnd-image'
      }),
      { 
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})