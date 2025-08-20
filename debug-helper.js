// Debug Helper - Run this in browser console to get all debug info
// Copy and paste this entire script into the browser console after trying audio

function exportAllDebugInfo() {
  console.log('🔍 COMPREHENSIVE DEBUG EXPORT STARTING...');
  
  const debugInfo = {
    timestamp: new Date().toISOString(),
    
    // TTS Mystery Details
    ttsError: window.__tts_mystery_error || null,
    
    // Audio Playback Mystery Details  
    audioError: window.__audio_mystery_error || null,
    
    // All Debug Logs
    debugLogs: window.__debug_errors || [],
    
    // Browser Environment
    browserInfo: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor,
      language: navigator.language,
      languages: navigator.languages,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      hardwareConcurrency: navigator.hardwareConcurrency,
      maxTouchPoints: navigator.maxTouchPoints,
      doNotTrack: navigator.doNotTrack,
      
      // Screen info
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth
      },
      
      // Window info
      window: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        location: window.location.href
      },
      
      // Document info
      document: {
        visibilityState: document.visibilityState,
        hasFocus: document.hasFocus(),
        activeElement: document.activeElement?.tagName,
        domain: document.domain,
        referrer: document.referrer
      }
    },
    
    // Audio Capabilities
    audioCapabilities: {
      audioContext: typeof AudioContext !== 'undefined',
      webAudio: typeof window.AudioContext !== 'undefined' || typeof window.webkitAudioContext !== 'undefined',
      htmlAudio: typeof Audio !== 'undefined',
      
      // Format support
      formats: (() => {
        try {
          const audio = new Audio();
          return {
            mp3: audio.canPlayType('audio/mpeg'),
            ogg: audio.canPlayType('audio/ogg'),
            wav: audio.canPlayType('audio/wav'),
            aac: audio.canPlayType('audio/aac'),
            m4a: audio.canPlayType('audio/mp4'),
            webm: audio.canPlayType('audio/webm'),
          };
        } catch (e) {
          return { error: e.message };
        }
      })(),
      
      // Web Audio API details
      webAudioDetails: (() => {
        try {
          if (typeof AudioContext !== 'undefined') {
            const ctx = new AudioContext();
            const info = {
              state: ctx.state,
              sampleRate: ctx.sampleRate,
              baseLatency: ctx.baseLatency || 'not supported',
              outputLatency: ctx.outputLatency || 'not supported'
            };
            ctx.close();
            return info;
          }
          return 'AudioContext not available';
        } catch (e) {
          return { error: e.message };
        }
      })()
    },
    
    // Memory Information
    memoryInfo: (() => {
      try {
        return performance.memory ? {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        } : 'Memory info not available';
      } catch {
        return 'Memory info not accessible';
      }
    })(),
    
    // Console Errors (if any exist)
    consoleErrors: window.__console_errors || 'No console error capture setup',
    
    // Local Storage & Session Storage
    storage: {
      localStorage: (() => {
        try {
          const keys = Object.keys(localStorage);
          return keys.reduce((acc, key) => {
            if (key.includes('tts') || key.includes('audio') || key.includes('dnd') || key.includes('debug')) {
              acc[key] = localStorage.getItem(key);
            }
            return acc;
          }, {});
        } catch (e) {
          return { error: 'Cannot access localStorage' };
        }
      })(),
      
      sessionStorage: (() => {
        try {
          const keys = Object.keys(sessionStorage);
          return keys.reduce((acc, key) => {
            if (key.includes('tts') || key.includes('audio') || key.includes('dnd') || key.includes('debug')) {
              acc[key] = sessionStorage.getItem(key);
            }
            return acc;
          }, {});
        } catch (e) {
          return { error: 'Cannot access sessionStorage' };
        }
      })()
    },
    
    // Feature Detection
    features: {
      fetch: typeof fetch !== 'undefined',
      promises: typeof Promise !== 'undefined',
      webWorkers: typeof Worker !== 'undefined',
      serviceWorkers: 'serviceWorker' in navigator,
      geolocation: 'geolocation' in navigator,
      notifications: 'Notification' in window,
      fullscreen: 'requestFullscreen' in document.documentElement,
      webGL: (() => {
        try {
          const canvas = document.createElement('canvas');
          return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch {
          return false;
        }
      })()
    }
  };
  
  console.log('🎯 COMPLETE DEBUG INFORMATION:');
  console.log(JSON.stringify(debugInfo, null, 2));
  
  // Create downloadable file
  const blob = new Blob([JSON.stringify(debugInfo, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dnd-audio-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log('✅ Debug information has been downloaded as JSON file!');
  console.log('📋 You can also copy the debug info from the console output above');
  
  return debugInfo;
}

// Make it available globally
window.exportAllDebugInfo = exportAllDebugInfo;

console.log('🛠️ DEBUG HELPER LOADED!');
console.log('📝 Try to reproduce the audio issue, then run: exportAllDebugInfo()');
console.log('💾 This will download a complete debug report as a JSON file');