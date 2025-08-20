import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fail-fast API key validation
function validateRunwayAPIKey(): string {
  const apiKey = Deno.env.get('RUNWAY_TOKEN')
  
  if (!apiKey || apiKey.trim().length === 0) {
    console.error('Runway API key not configured')
    throw new Error('RUNWAY_API_KEY is missing or empty. Check Supabase secrets and re-deploy.')
  }
  
  if (!apiKey.startsWith('key_')) {
    console.error('Invalid Runway API key format')
    throw new Error('Invalid Runway API key format - must start with "key_"')
  }
  
  if (apiKey.length < 20) {
    console.error('Invalid Runway API key length')
    throw new Error('Invalid Runway API key length - too short')
  }
  
  return apiKey
}

serve(async (req) => {
  console.log('🎬 Runway Gen-4 function called - Updated with X-Runway-Version header!')
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, taskId } = await req.json()
    console.log('📝 Request data:', { promptLength: prompt?.length || 0, taskId: taskId || 'none' })
    
    const apiKey = validateRunwayAPIKey()

    // If taskId provided, check status of existing task
    if (taskId) {
      console.log('📊 Checking status for task:', taskId)
      
      const statusResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Runway-Version': '2024-11-06',
        },
      })

      console.log('📊 Status response:', statusResponse.status, statusResponse.statusText)

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text()
        console.error('❌ Status check error:', errorText)
        throw new Error(`Status check failed: ${statusResponse.statusText} - ${errorText}`)
      }

      const statusData = await statusResponse.json()
      console.log('📊 Task status:', statusData.status)
      
      // Check if this is a completed task with output
      if (statusData.status === 'SUCCEEDED' && statusData.output?.[0]) {
        const outputUrl = statusData.output[0]
        const isVideoFile = outputUrl.includes('.mp4') || outputUrl.includes('.mov') || outputUrl.includes('.webm')
        const isImageTask = (
          (outputUrl.includes('.png') || outputUrl.includes('.jpg') || outputUrl.includes('.jpeg')) &&
          !isVideoFile
        )
        
        // If this is a completed video, return the video URL
        if (isVideoFile) {
          console.log('🎬 Video generation completed!')
          return new Response(JSON.stringify({
            videoUrl: outputUrl,
            status: 'COMPLETED',
            type: 'video_generation'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        
        if (isImageTask) {
          console.log('🖼️ Image generation completed, starting video conversion ONCE')
          
          const generatedImageUrl = outputUrl
          console.log('🖼️ Generated image URL:', generatedImageUrl)

          // Step 2: Convert image to video
          const videoPayload = {
            promptImage: generatedImageUrl,
            model: 'gen3a_turbo',
            ratio: '1280:768',
            duration: 5
          }

          console.log('📝 Video generation payload:', JSON.stringify(videoPayload, null, 2))

          const videoResponse = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'X-Runway-Version': '2024-11-06',
            },
            body: JSON.stringify(videoPayload),
          })

          if (!videoResponse.ok) {
            const errorText = await videoResponse.text()
            console.error('❌ Video generation error:', errorText)
            throw new Error(`Video generation failed: ${videoResponse.statusText} - ${errorText}`)
          }

          const videoTaskData = await videoResponse.json()
          console.log('✅ Video generation task created:', videoTaskData.id)

          return new Response(JSON.stringify({
            taskId: videoTaskData.id,
            status: 'PENDING',
            type: 'video_generation',
            message: 'Step 2/2: Converting image to video...',
            newTaskId: true // Flag to indicate task ID changed
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
      
      // For all other cases (video tasks, pending image tasks), just return status
      return new Response(JSON.stringify(statusData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 1: Generate image from text prompt
    console.log('🖼️ Starting image generation for text-to-video conversion')
    
    const imagePayload = {
      promptText: `Epic D&D fantasy scene: ${prompt}. Cinematic, dramatic lighting, medieval fantasy style, highly detailed, magical atmosphere.`,
      model: 'gen4_image',
      ratio: '1280:720'
    }

    console.log('📝 Image generation payload:', JSON.stringify(imagePayload, null, 2))

    const imageResponse = await fetch('https://api.dev.runwayml.com/v1/text_to_image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify(imagePayload),
    })

    console.log('🖼️ Image generation response:', imageResponse.status, imageResponse.statusText)

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text()
      console.error('❌ Image generation error:', errorText)
      throw new Error(`Image generation failed: ${imageResponse.statusText} - ${errorText}`)
    }

    const imageTaskData = await imageResponse.json()
    console.log('✅ Image generation task created:', imageTaskData.id)

    // Return the image task ID with a special format to indicate it's a two-step process
    return new Response(
      JSON.stringify({ 
        taskId: imageTaskData.id,
        status: 'PENDING',
        type: 'image_generation',
        message: 'Step 1/2: Generating image from text prompt...'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

    
  } catch (error) {
    console.error('💥 Runway Gen-4 Error:', error.message)
    console.error('💥 Full error:', error)
    
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
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: 'Video generation failed - check logs for details',
        service: 'dnd-video',
        provider: 'runway'
      }),
      { 
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})