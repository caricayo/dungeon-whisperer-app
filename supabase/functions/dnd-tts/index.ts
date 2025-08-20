import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Function to split long text into smaller chunks
function splitTextIntoChunks(text: string, maxChunkSize: number = 3000): string[] {
  if (text.length <= maxChunkSize) {
    return [text]
  }

  const chunks: string[] = []
  const sentences = text.split(/[.!?]\s+/)
  let currentChunk = ''

  for (const sentence of sentences) {
    const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + sentence
    
    if (potentialChunk.length <= maxChunkSize) {
      currentChunk = potentialChunk
    } else {
      if (currentChunk) {
        chunks.push(currentChunk + '.')
        currentChunk = sentence
      } else {
        // Single sentence is too long, force split
        chunks.push(sentence.substring(0, maxChunkSize))
        currentChunk = sentence.substring(maxChunkSize)
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk + '.')
  }

  return chunks
}

// Function to merge audio buffers
async function mergeAudioBuffers(buffers: Uint8Array[]): Promise<Uint8Array> {
  const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0)
  const merged = new Uint8Array(totalLength)
  
  let offset = 0
  for (const buffer of buffers) {
    merged.set(buffer, offset)
    offset += buffer.length
  }
  
  return merged
}

serve(async (req) => {
  console.log('🎤 Enhanced TTS function called with chunking support!')
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, voice = 'fable', model = 'tts-1', speed = 1.0 } = await req.json()
    
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured.')
    }
    
    // Clean text for TTS
    const cleanedText = text
      .replace(/[🎲⚔️🏰🌟🐉💀🗡️🛡️🧙‍♂️🧙‍♀️]/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\[(.*?)\]/g, '')
      .trim()

    console.log(`📝 Processing text: ${cleanedText.length} characters`)

    // Check if text is too long and needs chunking
    if (cleanedText.length > 3000) {
      console.log('📦 Text too long, splitting into chunks...')
      
      const chunks = splitTextIntoChunks(cleanedText, 3000)
      console.log(`🔢 Split into ${chunks.length} chunks`)
      
      const audioBuffers: Uint8Array[] = []
      
      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        console.log(`🎵 Processing chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`)
        
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            input: chunks[i],
            voice,
            response_format: 'mp3',
            speed,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(`Chunk ${i + 1} failed: ${error.error?.message || 'TTS generation failed'}`)
        }

        const arrayBuffer = await response.arrayBuffer()
        audioBuffers.push(new Uint8Array(arrayBuffer))
        console.log(`✅ Chunk ${i + 1} completed: ${arrayBuffer.byteLength} bytes`)
        
        // Add small delay between requests to avoid rate limits
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
      
      console.log('🔗 Merging audio chunks...')
      const mergedAudio = await mergeAudioBuffers(audioBuffers)
      const base64Audio = encode(mergedAudio)
      
      console.log(`✅ Merged audio: ${mergedAudio.length} bytes, Base64: ${base64Audio.length} chars`)
      
      return new Response(
        JSON.stringify({ 
          audioContent: base64Audio,
          chunksProcessed: chunks.length,
          totalSize: mergedAudio.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
      
    } else {
      // Process normally for short text
      console.log('📝 Processing single chunk...')
      
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: cleanedText,
          voice,
          response_format: 'mp3',
          speed,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to generate speech')
      }

      const arrayBuffer = await response.arrayBuffer()
      const audioBytes = new Uint8Array(arrayBuffer)
      
      console.log('🎵 Audio buffer size:', arrayBuffer.byteLength, 'bytes')
      
      const base64Audio = encode(audioBytes)
      
      console.log('✅ Base64 conversion successful, length:', base64Audio.length)

      return new Response(
        JSON.stringify({ audioContent: base64Audio }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('💥 TTS Edge Function Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'TTS processing failed - check logs for details'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})