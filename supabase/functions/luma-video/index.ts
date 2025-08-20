import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function validateLumaAPIKey(): string {
  const apiKey = Deno.env.get('LUMA_API_KEY');
  if (!apiKey) {
    throw new Error('LUMA_API_KEY environment variable is not set');
  }
  if (!apiKey.startsWith('luma-')) {
    throw new Error('Invalid LUMA_API_KEY format. Must start with "luma-"');
  }
  return apiKey;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = validateLumaAPIKey();
    const { prompt, taskId } = await req.json();

    // If taskId is provided, check the status of existing generation
    if (taskId) {
      console.log(`Checking status for task: ${taskId}`);
      
      const statusResponse = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!statusResponse.ok) {
        const error = await statusResponse.text();
        console.error('Luma status check failed:', error);
        throw new Error(`Failed to check generation status: ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json();
      console.log('Luma status response:', statusData);

      // Check if video generation is completed
      if (statusData.state === 'completed' && statusData.assets?.video) {
        console.log('🎬 Luma video generation completed!');
        return new Response(JSON.stringify({
          videoUrl: statusData.assets.video,
          status: 'COMPLETED',
          type: 'video_generation',
          taskId: statusData.id
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Return status for pending/processing videos
      return new Response(JSON.stringify({
        status: statusData.state?.toUpperCase() || 'PENDING',
        taskId: statusData.id,
        type: 'video_generation'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Start new video generation
    if (!prompt) {
      throw new Error('Prompt is required for video generation');
    }

    console.log('Starting Luma video generation with prompt:', prompt);

    const generationResponse = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        model: 'ray-2', // Use ray-2 model for good quality/speed balance
        aspect_ratio: '16:9',
        loop: false,
      }),
    });

    if (!generationResponse.ok) {
      const error = await generationResponse.text();
      console.error('Luma generation failed:', error);
      throw new Error(`Failed to start video generation: ${generationResponse.status}`);
    }

    const generationData = await generationResponse.json();
    console.log('Luma generation started:', generationData);

    return new Response(JSON.stringify(generationData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in luma-video function:', error);
    
    // Determine appropriate status code
    let status = 500;
    let errorMessage = error.message || 'Video generation failed';
    
    if (error.message?.includes('API key')) {
      status = 401;
    } else if (error.message?.includes('rate limit')) {
      status = 429;
    } else if (error.message?.includes('Invalid request')) {
      status = 400;
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: 'Video generation failed - check logs for details',
      service: 'luma-video',
      provider: 'luma'
    }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});