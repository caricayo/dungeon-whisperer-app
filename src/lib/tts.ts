import { supabase } from '@/integrations/supabase/client';
import { debugLog, debugError } from '@/lib/debug';
import { settingsService } from '@/lib/settings';
import DemoModeAPIGuard from '@/lib/demo-mode-guard';

interface TTSOptions {
  voice?: string // ElevenLabs voice ID or OpenAI voice name
  model?: string // ElevenLabs model or OpenAI model
  speed?: number // OpenAI only
  provider?: 'elevenlabs' | 'openai' | 'auto' // Which service to use
}

interface TTSResponse {
  audioContent: string;
  provider: string;
  voice?: string;
  model?: string;
}

class TextToSpeechService {
  private currentAudio: HTMLAudioElement | null = null
  private isPlaying = false
  private readonly blobUrls = new Map<string, Blob>() // For cleanup
  
  private storeBlobForCleanup(url: string, blob: Blob): void {
    this.blobUrls.set(url, blob);
    debugLog('🗂️ BLOB STORED:', url, 'Total blobs tracked:', this.blobUrls.size);
  }
  
  private cleanupBlobUrl(url: string): void {
    if (this.blobUrls.has(url)) {
      URL.revokeObjectURL(url);
      this.blobUrls.delete(url);
      debugLog('🗑️ BLOB CLEANED:', url, 'Remaining blobs:', this.blobUrls.size);
    }
  }
  
  private cleanupAllBlobs(): void {
    this.blobUrls.forEach((blob, url) => {
      URL.revokeObjectURL(url);
    });
    this.blobUrls.clear();
    debugLog('🗑️ ALL BLOBS CLEANED');
  }
  
  private checkUserInteraction(): boolean {
    // Check if there has been recent user interaction
    // This is a heuristic since we can't directly check browser interaction state
    try {
      // Try to access some browser features that require user interaction
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      return ctx !== null && document.hasFocus();
    } catch {
      return false;
    }
  }
  
  private async playWithRetry(audio: HTMLAudioElement, maxRetries: number): Promise<void> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        debugLog(`🔊 AUDIO RETRY: Attempt ${attempt}/${maxRetries}`);
        await audio.play();
        debugLog(`🔊 AUDIO RETRY: Success on attempt ${attempt}`);
        return; // Success!
      } catch (error) {
        lastError = error as Error;
        debugLog(`🔊 AUDIO RETRY: Failed attempt ${attempt}:`, error);
        
        // Don't retry certain errors
        if (error.name === 'NotAllowedError' || error.name === 'NotSupportedError') {
          debugLog('🔊 AUDIO RETRY: Non-retryable error, aborting');
          break;
        }
        
        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          debugLog(`🔊 AUDIO RETRY: Waiting ${delayMs}ms before next attempt`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    // All retries failed
    throw lastError || new Error('Audio playback failed after all retries');
  }
  
  async generateSpeech(text: string, options: TTSOptions = {}): Promise<string> {
    debugLog('🎵 TTS START: Generating speech for text:', text.substring(0, 100) + '...')
    debugLog('🎵 TTS OPTIONS:', options)
    
    if (!text?.trim()) {
      throw new Error('Text is required for TTS generation');
    }

    // Always get user's saved voice settings if no options are specified
    let voiceSettings = null;
    if (!options.voice && !options.provider && !options.speed) {
      voiceSettings = await settingsService.getVoiceSettings();
      debugLog('🎵 Loaded user voice settings:', voiceSettings);
    }

    const provider = options.provider || voiceSettings?.provider || 'elevenlabs'; // Default to ElevenLabs
    const voice = options.voice || voiceSettings?.voiceId || 'BNgbHR0DNeZixGQVzloa';
    const speed = options.speed || voiceSettings?.speed || 1.0;
    
    debugLog('🎵 Using provider:', provider, 'voice:', voice, 'speed:', speed);
    
    // Try ElevenLabs first (unless specifically requesting OpenAI)
    if (provider === 'elevenlabs' || provider === 'auto') {
      try {
        return await this.generateWithElevenLabs(text, { ...options, voice, speed });
      } catch (error) {
        debugError('🎵 ElevenLabs TTS failed:', error);
        
        // If specifically requesting ElevenLabs, don't fallback
        if (provider === 'elevenlabs') {
          throw error;
        }
        
        // Otherwise, try OpenAI fallback
        debugLog('🎵 Falling back to OpenAI TTS...');
      }
    }
    
    // Use OpenAI (either requested or as fallback)
    return this.generateWithOpenAI(text, { ...options, voice, speed });
  }

  private async generateWithElevenLabs(text: string, options: TTSOptions): Promise<string> {
    debugLog('🎵 Trying ElevenLabs TTS...');
    
    // Use provided voice or get from user settings
    let voiceId = options.voice;
    if (!voiceId) {
      const voiceSettings = await settingsService.getVoiceSettings();
      voiceId = voiceSettings?.voiceId || 'BNgbHR0DNeZixGQVzloa';
      debugLog('🎵 Using saved voice ID:', voiceId);
    }
    
    const { data, error } = await DemoModeAPIGuard.guardSupabaseFunction(
      'elevenlabs-tts',
      () => supabase.functions.invoke('elevenlabs-tts', {
        body: {
          text: text.trim(),
          voice: voiceId,
          model: options.model || 'eleven_turbo_v2_5',
          speed: options.speed || 1.0, // Pass speed for potential server-side handling
        }
      }),
      {
        operationName: 'ElevenLabs Text-to-Speech',
        fallbackData: null
      }
    );

    if (error) {
      throw new Error(error.message || 'ElevenLabs TTS service error');
    }

    return await this.processAudioResponse(data, 'ElevenLabs');
  }

  private async generateWithOpenAI(text: string, options: TTSOptions): Promise<string> {
    debugLog('🎵 Using OpenAI TTS...');
    
    const { data, error } = await DemoModeAPIGuard.guardSupabaseFunction(
      'dnd-tts',
      () => supabase.functions.invoke('dnd-tts', {
        body: {
          text: text.trim(),
          voice: this.mapToOpenAIVoice(options.voice) || 'alloy',
          model: options.model || 'tts-1',
          speed: options.speed || 1.0,
        }
      }),
      {
        operationName: 'OpenAI Text-to-Speech',
        fallbackData: null
      }
    );

    if (error) {
      throw new Error(error.message || 'OpenAI TTS service error');
    }

    return await this.processAudioResponse(data, 'OpenAI');
  }

  private mapToOpenAIVoice(voice?: string): string {
    // Map ElevenLabs voice IDs to OpenAI voice names
    const voiceMap: Record<string, string> = {
      'BNgbHR0DNeZixGQVzloa': 'nova',  // User's voice -> Nova
      '9BWtsMINqrJLrRacOk9x': 'nova',  // Aria -> Nova
      'EXAVITQu4vr4xnSDxMaL': 'alloy', // Sarah -> Alloy
      'IKne3meq5aSn9XLyUdCD': 'echo',  // Charlie -> Echo
      'TX3LPaxmHKxFdv7VOQHJ': 'onyx',  // Liam -> Onyx
      'XB0fDUnXU5powFXDhCwa': 'shimmer', // Charlotte -> Shimmer
    };

    return voiceMap[voice || ''] || voice || 'alloy';
  }

  private async processAudioResponse(data: TTSResponse, provider: string): Promise<string> {
    debugLog(`🎵 ${provider} TTS SUCCESS: Received audio data, content length:`, data.audioContent?.length || 'unknown')
    
    if (!data?.audioContent) {
      throw new Error(`No audio content received from ${provider} TTS service`);
    }

    try {
      // Use native fetch API for better base64 handling
      const dataUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      const response = await fetch(dataUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to process audio data: ${response.status}`);
      }
      
      const audioBlob = await response.blob();
      
      // Validate blob
      if (audioBlob.size === 0) {
        throw new Error(`Generated audio blob is empty from ${provider}`);
      }
      
      if (audioBlob.size < 100) {
        debugLog(`🎵 ${provider} WARNING: Audio blob suspiciously small:`, audioBlob.size, 'bytes');
      }
      
      // Enhanced MIME type detection
      const actualMimeType = audioBlob.type || 'audio/mpeg';
      debugLog(`🎵 ${provider} DETECTED MIME TYPE:`, actualMimeType);
      
      // Validate and correct MIME type with fallbacks
      const validAudioMimes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac'];
      let finalMimeType = actualMimeType;
      
      if (!actualMimeType.startsWith('audio/')) {
        // Try to detect from provider
        finalMimeType = provider === 'OpenAI' ? 'audio/mpeg' : 'audio/mpeg';
        debugLog(`🎵 ${provider} CORRECTED MIME TYPE:`, finalMimeType);
      }
      
      // Create blob with enhanced MIME type handling
      const correctedBlob = new Blob([audioBlob], { type: finalMimeType });
      
      const audioUrl = URL.createObjectURL(correctedBlob);
      debugLog(`🎵 ${provider} BLOB CREATED: Audio URL generated:`, audioUrl);
      debugLog(`🎵 ${provider} BLOB SIZE:`, correctedBlob.size, 'bytes');
      
      // Store blob reference for cleanup
      this.storeBlobForCleanup(audioUrl, correctedBlob);
      
      return audioUrl;
      
    } catch (blobError) {
      debugError(`🎵 ${provider} BLOB ERROR: Failed to create audio blob:`, blobError);
      
      // Fallback: manual base64 decoding with better error handling
      try {
        debugLog(`🎵 ${provider} FALLBACK: Attempting manual base64 decode...`);
        
        let base64Data = data.audioContent;
        
        // Clean base64 string
        base64Data = base64Data.replace(/[^A-Za-z0-9+/=]/g, '');
        
        // Add padding if needed
        while (base64Data.length % 4) {
          base64Data += '=';
        }
        
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Try different MIME types
        const mimeTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'];
        
        for (const mimeType of mimeTypes) {
          try {
            const audioBlob = new Blob([bytes], { type: mimeType });
            const audioUrl = URL.createObjectURL(audioBlob);
            debugLog(`🎵 ${provider} FALLBACK SUCCESS with MIME:`, mimeType);
            
            // Store blob reference for cleanup
            this.storeBlobForCleanup(audioUrl, audioBlob);
            
            return audioUrl;
          } catch (mimeError) {
            debugLog(`🎵 ${provider} MIME TYPE FAILED:`, mimeType, mimeError);
          }
        }
        
        throw new Error('All MIME types failed');
      } catch (fallbackError) {
        debugError(`🎵 ${provider} FALLBACK FAILED:`, fallbackError);
        
        // Create comprehensive mystery error details
        const mysteryDetails = {
          provider: provider,
          timestamp: new Date().toISOString(),
          audioDataReceived: !!data?.audioContent,
          audioDataLength: data?.audioContent?.length || 0,
          audioDataSample: data?.audioContent?.substring(0, 100) + '...',
          originalError: blobError?.message || 'Unknown blob error',
          fallbackError: fallbackError?.message || 'Unknown fallback error',
          browserInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine
          },
          audioSupport: {
            audioContext: typeof AudioContext !== 'undefined',
            webAudio: typeof window.AudioContext !== 'undefined' || typeof window.webkitAudioContext !== 'undefined',
            htmlAudio: typeof Audio !== 'undefined',
            canPlayMP3: (() => {
              try {
                const audio = new Audio();
                return audio.canPlayType && audio.canPlayType('audio/mpeg') !== '';
              } catch {
                return false;
              }
            })()
          },
          fetchSupport: {
            nativeFetch: typeof fetch !== 'undefined',
            urlApi: typeof URL !== 'undefined',
            blobApi: typeof Blob !== 'undefined'
          },
          memoryInfo: (() => {
            try {
              return (performance as any).memory ? {
                usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
                totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
                jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
              } : 'Not available';
            } catch {
              return 'Not accessible';
            }
          })(),
          debugSteps: [
            `1. API Response: ${data?.audioContent ? 'SUCCESS' : 'FAILED'}`,
            `2. Base64 Length: ${data?.audioContent?.length || 0} chars`,
            `3. Data URL Creation: ${blobError ? 'FAILED' : 'SUCCESS'}`,
            `4. Fetch Response: ${blobError?.message || 'Unknown'}`,
            `5. Fallback Decode: ${fallbackError?.message || 'Unknown'}`
          ]
        };
        
        debugError(`🔍 COMPREHENSIVE TTS MYSTERY ANALYSIS:`, mysteryDetails);
        
        // Store mystery for retrieval by user
        (window as any).__tts_mystery_error = mysteryDetails;
        
        const friendlyError = `🎭 **The D&D Audio Spirits are Troubled!** 🎭

**Mystery Details:**
- Provider: ${provider}
- Audio received: ${data?.audioContent ? 'Yes' : 'No'} (${data?.audioContent?.length || 0} chars)
- Browser: ${navigator.userAgent.split(' ').pop()}
- Audio support: ${(() => {
          try {
            const audio = new Audio();
            return audio.canPlayType && audio.canPlayType('audio/mpeg') !== '' ? 'Yes' : 'No';
          } catch {
            return 'No';
          }
        })()}

**Technical Incantation Failed:**
• Original spell: ${blobError?.message || 'Unknown blob conjuring error'}
• Backup spell: ${fallbackError?.message || 'Unknown fallback error'}

**Mystical Investigation:**
${mysteryDetails.debugSteps.join('\n')}

**Possible Curses:**
• Browser security restrictions blocking audio
• Corrupted audio data from the TTS realm
• Memory limitations preventing audio creation
• Network interference during data transmission

**Ancient Remedies:**
• Try refreshing the browser page
• Click somewhere on the page first (for autoplay permissions)
• Check browser console for the full mystery details
• Try a different browser or device

*Type \`window.__tts_mystery_error\` in browser console for full diagnostic data*`;

        throw new Error(friendlyError);
      }
    }
  }

  async play(audioUrl: string, speed = 1.0): Promise<void> {
    debugLog('🔊 AUDIO PLAY START: Attempting to play audio from URL:', audioUrl)
    
    this.stop() // Stop any currently playing audio
    
    // Enhanced blob validation
    if (!audioUrl?.startsWith('blob:')) {
      throw new Error('Invalid audio URL: Expected blob URL');
    }
    
    // Check if blob still exists
    if (!this.blobUrls.has(audioUrl)) {
      debugLog('🔊 WARNING: Blob URL not found in tracking map');
    }
    
    // Debug: Test blob URL accessibility
    try {
      const testResponse = await fetch(audioUrl);
      debugLog('🔍 Blob URL test fetch:', testResponse.status, testResponse.statusText);
      if (!testResponse.ok) {
        throw new Error(`Blob URL not accessible: ${testResponse.status}`);
      }
    } catch (error) {
      debugError('🔍 Blob URL test failed:', error);
      throw new Error(`Blob URL test failed: ${error.message}`);
    }
    
    this.currentAudio = new Audio(audioUrl)
    this.currentAudio.playbackRate = speed; // Apply speed control client-side
    
    // Enhanced visibility and interaction checks
    if (document.visibilityState === 'hidden') {
      throw new Error('Cannot play audio while page is not visible');
    }
    
    // Check for user interaction (required for autoplay in many browsers)
    const hasUserInteraction = this.checkUserInteraction();
    if (!hasUserInteraction) {
      debugLog('🔊 WARNING: No recent user interaction detected - playback may fail');
    }
    
    // Add comprehensive event listeners for debugging
    this.currentAudio.onloadstart = () => debugLog('🔊 AUDIO EVENT: loadstart')
    this.currentAudio.onloadeddata = () => debugLog('🔊 AUDIO EVENT: loadeddata')
    this.currentAudio.oncanplay = () => debugLog('🔊 AUDIO EVENT: canplay')
    this.currentAudio.oncanplaythrough = () => debugLog('🔊 AUDIO EVENT: canplaythrough')
    this.currentAudio.onplay = () => debugLog('🔊 AUDIO EVENT: play started')
    this.currentAudio.onplaying = () => debugLog('🔊 AUDIO EVENT: playing')
    this.currentAudio.onended = () => {
      debugLog('🔊 AUDIO EVENT: ended')
      this.isPlaying = false
    }
    this.currentAudio.onerror = (e) => {
      debugError('🔊 AUDIO ERROR:', e)
      debugError('🔊 AUDIO ERROR DETAILS:', this.currentAudio?.error)
      this.isPlaying = false
    }
    this.currentAudio.onpause = () => debugLog('🔊 AUDIO EVENT: paused')
    this.currentAudio.onstalled = () => debugLog('🔊 AUDIO EVENT: stalled')
    this.currentAudio.onsuspend = () => debugLog('🔊 AUDIO EVENT: suspend')
    this.currentAudio.onwaiting = () => debugLog('🔊 AUDIO EVENT: waiting')
    
    try {
      debugLog('🔊 AUDIO PLAY: About to call play()')
      
      // Try playback with retry logic
      await this.playWithRetry(this.currentAudio, 3);
      
      // Additional verification that audio is actually playing
      setTimeout(() => {
        if (this.currentAudio && this.currentAudio.paused) {
          debugError('🔊 AUDIO VERIFICATION: Audio element is still paused after play attempt');
        }
      }, 100);
      
      this.isPlaying = true
      debugLog('🔊 AUDIO PLAY: Successfully started playback')
    } catch (error) {
      debugError('🔊 AUDIO PLAY ERROR:', error)
      this.isPlaying = false
      
      // Enhanced error reporting with comprehensive diagnostics
      const playbackMystery = {
        timestamp: new Date().toISOString(),
        audioUrl: audioUrl,
        audioUrlValid: audioUrl?.startsWith('blob:'),
        blobTracked: this.blobUrls.has(audioUrl),
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        audioElementState: this.currentAudio ? {
          src: this.currentAudio.src,
          readyState: this.currentAudio.readyState,
          networkState: this.currentAudio.networkState,
          error: this.currentAudio.error ? {
            code: this.currentAudio.error.code,
            message: this.currentAudio.error.message
          } : null,
          paused: this.currentAudio.paused,
          duration: this.currentAudio.duration,
          currentTime: this.currentAudio.currentTime
        } : null,
        documentState: {
          visibilityState: document.visibilityState,
          hasFocus: document.hasFocus(),
          activeElement: document.activeElement?.tagName
        },
        userInteraction: this.checkUserInteraction(),
        audioSupport: {
          canPlayMP3: (() => {
            try {
              const audio = new Audio();
              return audio.canPlayType('audio/mpeg');
            } catch {
              return 'unknown';
            }
          })(),
          canPlayOGG: (() => {
            try {
              const audio = new Audio();
              return audio.canPlayType('audio/ogg');
            } catch {
              return 'unknown';
            }
          })(),
          canPlayWAV: (() => {
            try {
              const audio = new Audio();
              return audio.canPlayType('audio/wav');
            } catch {
              return 'unknown';
            }
          })()
        }
      };
      
      debugError('🔊 COMPREHENSIVE AUDIO PLAYBACK MYSTERY:', playbackMystery);
      (window as any).__audio_mystery_error = playbackMystery;
      
      if (error.name === 'NotAllowedError') {
        throw new Error(`🎭 **Audio Blocked by Browser Guards!** 🎭

The browser's security spirits have blocked audio playback!

**Mystery Details:**
• User interaction detected: ${this.checkUserInteraction() ? 'Yes' : 'No'}
• Document focus: ${document.hasFocus() ? 'Yes' : 'No'}
• Page visibility: ${document.visibilityState}

**Ancient Remedies:**
• Click anywhere on the page first, then try again
• Make sure the page tab is active and focused
• Some browsers require user interaction before any audio

*Type \`window.__audio_mystery_error\` in console for full details*`);
      } else if (error.name === 'NotSupportedError') {
        throw new Error(`🎭 **Audio Format Curse Detected!** 🎭

Your browser's audio spirits don't recognize this format!

**Mystery Details:**
• Audio URL: ${audioUrl?.substring(0, 50)}...
• MP3 Support: ${playbackMystery.audioSupport.canPlayMP3}
• OGG Support: ${playbackMystery.audioSupport.canPlayOGG}
• WAV Support: ${playbackMystery.audioSupport.canPlayWAV}

**Ancient Remedies:**
• Try a different browser (Chrome, Firefox, Safari)
• Update your browser to the latest version
• Clear browser cache and try again

*Type \`window.__audio_mystery_error\` in console for full details*`);
      } else if (error.name === 'AbortError') {
        throw new Error(`🎭 **Audio Interrupted by Dark Magic!** 🎭

The audio spell was interrupted mid-casting!

**Mystery Details:**
• Audio was playing: ${!this.currentAudio?.paused}
• Network state: ${this.currentAudio?.networkState}
• Ready state: ${this.currentAudio?.readyState}

**Ancient Remedies:**
• Wait a moment and try again
• Check your internet connection
• The audio data might be corrupted

*Type \`window.__audio_mystery_error\` in console for full details*`);
      }
      
      // Generic error with comprehensive details
      throw new Error(`🎭 **Unknown Audio Curse Detected!** 🎭

A mysterious error has befallen the audio realm!

**Mystery Details:**
• Error Type: ${error.name || 'Unknown'}
• Error Message: ${error.message || 'No message'}
• Audio URL Valid: ${audioUrl?.startsWith('blob:') ? 'Yes' : 'No'}
• Browser: ${navigator.userAgent.split(' ').pop()}

**Technical Incantation Failed:**
${error.message || error.name || 'Unknown error'}

**Ancient Remedies:**
• Refresh the page and try again
• Try a different browser
• Check browser console for more details
• Make sure you clicked on the page first

*Type \`window.__audio_mystery_error\` in console for complete diagnostic data*

**Full Error Stack:**
${error.stack || 'No stack trace available'}`)
    }
  }

  pause(): void {
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.isPlaying = false
    }
  }

  resume(speed = 1.0): void {
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.playbackRate = speed; // Update speed on resume
      this.currentAudio.play()
      this.isPlaying = true
    }
  }

  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.currentTime = 0
      
      // Clean up the current audio blob URL if it exists
      if (this.currentAudio.src && this.currentAudio.src.startsWith('blob:')) {
        this.cleanupBlobUrl(this.currentAudio.src);
      }
      
      this.currentAudio = null;
      this.isPlaying = false
    }
  }
  
  // Enhanced cleanup for when service is destroyed
  cleanup(): void {
    this.stop();
    this.cleanupAllBlobs();
    debugLog('🧹 TTS SERVICE: Full cleanup completed');
  }

  getIsPlaying(): boolean {
    return this.isPlaying
  }

  // Enhanced method to get available voices
  getAvailableVoices() {
    return {
      elevenlabs: {
        'Your Voice': 'BNgbHR0DNeZixGQVzloa', // User's custom voice (default)
        'Aria': '9BWtsMINqrJLrRacOk9x',
        'Roger': 'CwhRBWXzGAHq8TQ4Fs17', 
        'Sarah': 'EXAVITQu4vr4xnSDxMaL',
        'Laura': 'FGY2WhTYpPnrIDTdsKH5',
        'Charlie': 'IKne3meq5aSn9XLyUdCD',
        'George': 'JBFqnCBsd6RMkjVDRZzb',
        'Callum': 'N2lVS1w4EtoT3dr4eOWO',
        'River': 'SAz9YHcvj6GT2YYXdXww',
        'Liam': 'TX3LPaxmHKxFdv7VOQHJ',
        'Charlotte': 'XB0fDUnXU5powFXDhCwa'
      },
      openai: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']
    };
  }
}

export const ttsService = new TextToSpeechService()
