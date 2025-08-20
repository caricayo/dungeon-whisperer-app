import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { text, voice, model, speed } = await req.json();

    if (!text?.trim()) {
      throw new Error('Text is required for TTS generation');
    }

    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenLabsApiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    // Default to user's persistent voice if none specified
    const voiceId = voice || 'BNgbHR0DNeZixGQVzloa'; // User's custom voice
    const modelId = model || 'eleven_turbo_v2_5'; // High quality, low latency
    
    console.log('ElevenLabs TTS request:', { 
      textLength: text.length, 
      voiceId, 
      modelId 
    });

    // Call ElevenLabs TTS API
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsApiKey,
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);
      
      // Check for specific errors
      if (response.status === 401) {
        throw new Error('Invalid ElevenLabs API key');
      } else if (response.status === 422) {
        throw new Error('Invalid request parameters for ElevenLabs');
      } else if (response.status === 429) {
        throw new Error('ElevenLabs rate limit exceeded');
      } else {
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }
    }

    // Convert audio response to base64
    const audioBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(audioBuffer);
    
    // Process in chunks to avoid stack overflow with large audio files
    let binaryString = '';
    const chunkSize = 8192; // Process 8KB at a time
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      binaryString += String.fromCharCode(...chunk);
    }
    
    const base64Audio = btoa(binaryString);

    console.log('ElevenLabs TTS success:', {
      audioSize: audioBuffer.byteLength,
      base64Length: base64Audio.length
    });

    return new Response(
      JSON.stringify({ 
        audioContent: base64Audio,
        provider: 'elevenlabs',
        voice: voiceId,
        model: modelId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('ElevenLabs TTS error:', error);
    
    // Determine appropriate status code
    let status = 500;
    let errorMessage = error.message || 'An error occurred during TTS generation';
    
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
        details: 'TTS generation failed - check logs for details',
        service: 'elevenlabs-tts',
        provider: 'elevenlabs'
      }),
      {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});