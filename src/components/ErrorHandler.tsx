import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  AlertTriangle, 
  RefreshCw, 
  ExternalLink,
  DollarSign,
  Key,
  Zap,
  Clock,
  Download,
  Bug
} from 'lucide-react';

export type ErrorType = 
  | 'quota_exceeded'
  | 'invalid_key'
  | 'rate_limit'
  | 'network_error'
  | 'service_unavailable'
  | 'unknown';

export interface ErrorInfo {
  type: ErrorType;
  service: string;
  message: string;
  technicalDetails?: string;
  timestamp: Date;
}

interface TTSError {
  provider: string;
  audioDataReceived: boolean;
  audioDataLength: number;
  browserInfo?: {
    userAgent?: string;
  };
  originalError?: string;
  fallbackError?: string;
}

interface AudioError {
  errorName: string;
  audioUrlValid: boolean;
  userInteraction: boolean;
  documentState?: {
    hasFocus: boolean;
  };
  audioSupport?: {
    canPlayMP3: boolean;
  };
}

interface DebugLog {
  type: string;
  args: unknown[];
}

interface WindowWithDebugInfo extends Window {
  __tts_mystery_error?: TTSError;
  __audio_mystery_error?: AudioError;
  __debug_errors?: DebugLog[];
}

interface ErrorHandlerProps {
  error: ErrorInfo;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const ErrorHandler: React.FC<ErrorHandlerProps> = ({
  error,
  onRetry,
  onDismiss,
  className
}) => {
  const getErrorIcon = () => {
    switch (error.type) {
      case 'quota_exceeded':
        return <DollarSign className="size-5 text-warning" />;
      case 'invalid_key':
        return <Key className="size-5 text-destructive" />;
      case 'rate_limit':
        return <Clock className="size-5 text-warning" />;
      case 'network_error':
        return <Zap className="size-5 text-destructive" />;
      default:
        return <AlertTriangle className="size-5 text-destructive" />;
    }
  };

  const getErrorTitle = () => {
    switch (error.type) {
      case 'quota_exceeded':
        return `${error.service} Quota Exhausted`;
      case 'invalid_key':
        return `${error.service} Authentication Failed`;
      case 'rate_limit':
        return `${error.service} Rate Limit Reached`;
      case 'network_error':
        return `Connection Issue`;
      case 'service_unavailable':
        return `${error.service} Temporarily Unavailable`;
      default:
        return `${error.service} Error`;
    }
  };

  const getErrorSolution = () => {
    switch (error.type) {
      case 'quota_exceeded':
        return (
          <div className="space-y-2">
            <p>The API quota for {error.service} has been exceeded.</p>
            <div className="flex flex-col gap-2 text-sm">
              <span>• Wait for quota reset (usually daily/monthly)</span>
              <span>• Try alternative services if available</span>
              <span>• Contact support if this persists</span>
            </div>
          </div>
        );
      
      case 'invalid_key':
        return (
          <div className="space-y-2">
            <p>The API key for {error.service} is invalid or expired.</p>
            <div className="flex flex-col gap-2 text-sm">
              <span>• Check your API key configuration</span>
              <span>• Ensure the key has proper permissions</span>
              <span>• Generate a new key if needed</span>
            </div>
          </div>
        );
      
      case 'rate_limit':
        return (
          <div className="space-y-2">
            <p>Too many requests sent to {error.service}. Please slow down.</p>
            <div className="flex flex-col gap-2 text-sm">
              <span>• Wait a few moments before retrying</span>
              <span>• Reduce the frequency of requests</span>
              <span>• Consider upgrading your API plan</span>
            </div>
          </div>
        );
      
      case 'network_error':
        return (
          <div className="space-y-2">
            <p>Unable to connect to {error.service}.</p>
            <div className="flex flex-col gap-2 text-sm">
              <span>• Check your internet connection</span>
              <span>• Retry the operation</span>
              <span>• Service may be temporarily down</span>
            </div>
          </div>
        );
      
      case 'service_unavailable':
        return (
          <div className="space-y-2">
            <p>{error.service} is temporarily unavailable.</p>
            <div className="flex flex-col gap-2 text-sm">
              <span>• Service is likely undergoing maintenance</span>
              <span>• Try again in a few minutes</span>
              <span>• Use alternative features if available</span>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="space-y-2">
            <p>An unexpected error occurred with {error.service}.</p>
            <div className="flex flex-col gap-2 text-sm">
              <span>• Try refreshing the page</span>
              <span>• Retry the operation</span>
              <span>• Contact support if this continues</span>
            </div>
            {error.technicalDetails && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Technical Details
                </summary>
                <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">
                  {error.technicalDetails}
                </pre>
              </details>
            )}
          </div>
        );
    }
  };

  const getFallbackMessage = () => {
    // Check for comprehensive mystery details
    const windowWithDebug = window as WindowWithDebugInfo;
    const ttsError = windowWithDebug.__tts_mystery_error;
    const audioError = windowWithDebug.__audio_mystery_error;
    const debugLogs = windowWithDebug.__debug_errors ?? [];
    
    // Enhanced D&D message with mystery details
    let mysteryAnalysis = '';
    
    if (ttsError || audioError) {
      mysteryAnalysis = `
🔍 **MYSTERY ANALYSIS REVEALED:**

📜 **Ancient Scroll of Debugging:**`;
      
      if (ttsError) {
        mysteryAnalysis += `
• **TTS Spell Components:**
  - Provider: ${ttsError.provider}
  - Audio Data: ${ttsError.audioDataReceived ? 'RECEIVED' : 'MISSING'} (${ttsError.audioDataLength} chars)
  - Browser Magic: ${ttsError.browserInfo?.userAgent ? String(ttsError.browserInfo.userAgent).split(' ').pop() ?? 'Unknown' : 'Unknown'}
  - Original Curse: ${ttsError.originalError ?? 'None'}
  - Fallback Curse: ${ttsError.fallbackError ?? 'None'}`;  
      }
      
      if (audioError) {
        mysteryAnalysis += `
• **Audio Playback Ritual:**
  - Error Type: ${audioError.errorName}
  - URL Valid: ${audioError.audioUrlValid ? 'YES' : 'NO'}
  - User Interaction: ${audioError.userInteraction ? 'DETECTED' : 'MISSING'}
  - Document Focus: ${audioError.documentState?.hasFocus ? 'YES' : 'NO'}
  - MP3 Support: ${audioError.audioSupport?.canPlayMP3 ?? 'Unknown'}`;
      }
      
      const recentErrors = debugLogs.slice(-5);
      if (recentErrors.length > 0) {
        mysteryAnalysis += `
• **Recent Magical Events:**`;
        recentErrors.forEach((log, index: number) => {
          mysteryAnalysis += `
  ${index + 1}. [${String(log.type ?? 'LOG').toUpperCase()}] ${String(log.args?.[0] ?? 'Unknown event').substring(0, 60)}...`;
        });
      }
      
      mysteryAnalysis += `

🧙‍♂️ **Wizard's Recommendations:**
• Type 'window.__tts_mystery_error' in console for TTS details
• Type 'window.__audio_mystery_error' in console for audio details  
• Type 'exportAllDebugInfo()' in console for complete analysis
• Try clicking anywhere on page first (for browser permissions)
• Check if browser supports MP3: ${audioError?.audioSupport?.canPlayMP3 ?? 'Unknown'}`;
    }
    
    return `🎲 *The mystical energies surrounding the ${error.service} seem disrupted...*

The Dungeon Master's connection to the ethereal planes is experiencing interference. 

*[${getErrorTitle()}]*${mysteryAnalysis}

Don't worry, adventurer - your quest continues! While the magical communication is restored, you can:
• Review your current situation and plan your next move
• Check your character sheet and inventory  
• Consider alternative approaches to your current challenge

The realm's magic should return shortly...`;
  };

  return (
    <Card className={`border-destructive/50 bg-destructive/5 p-4 ${className}`} style={{zIndex: 1000, position: 'relative'}}>
      <div className="flex items-start gap-3">
        {getErrorIcon()}
        <div className="min-w-0 flex-1">
          <h4 className="mb-2 font-semibold text-destructive">
            {getErrorTitle()}
          </h4>
          
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {getErrorSolution()}
            </div>

            <Alert>
              <AlertTriangle className="size-4" />
              <AlertDescription className="text-sm">
                <strong>D&D Fallback Response:</strong>
                <div className="mt-2 whitespace-pre-line rounded bg-muted p-2 text-xs">
                  {getFallbackMessage()}
                </div>
              </AlertDescription>
            </Alert>

            <div className="flex flex-wrap gap-2">
              {onRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRetry}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="size-4" />
                  Retry
                </Button>
              )}
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // Export debug information
                  try {
                    const windowWithDebug = window as WindowWithDebugInfo;
                    const debugInfo = {
                      timestamp: new Date().toISOString(),
                      error: error,
                      ttsError: windowWithDebug.__tts_mystery_error ?? null,
                      audioError: windowWithDebug.__audio_mystery_error ?? null,
                      debugLogs: windowWithDebug.__debug_errors ?? [],
                      browserInfo: {
                        userAgent: navigator.userAgent,
                        platform: navigator.platform,
                        language: navigator.language,
                        cookieEnabled: navigator.cookieEnabled,
                        onLine: navigator.onLine
                      }
                    };
                    
                    const blob = new Blob([JSON.stringify(debugInfo, null, 2)], { 
                      type: 'application/json' 
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `dnd-error-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch (e) {
                    console.error('Failed to export debug info:', e);
                  }
                }}
                className="flex items-center gap-2"
              >
                <Download className="size-4" />
                Export Debug
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // Copy debug commands to clipboard
                  const commands = `// Debug Commands - Copy these to browser console:
console.warn('TTS Error:', window.__tts_mystery_error);
console.warn('Audio Error:', window.__audio_mystery_error);
console.warn('All Debug Logs:', window.__debug_errors);

// Export all debug info (if debug helper is loaded):
exportAllDebugInfo();`;
                  navigator.clipboard.writeText(commands).then(() => {
                    alert('Debug commands copied to clipboard! Paste them in browser console.');
                  }).catch(() => {
                    // Fallback if clipboard API fails
                    const textArea = document.createElement('textarea');
                    textArea.value = commands;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    alert('Debug commands copied to clipboard! Paste them in browser console.');
                  });
                }}
                className="flex items-center gap-2"
              >
                <Bug className="size-4" />
                Copy Debug Commands
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open('https://docs.lovable.dev/tips-tricks/troubleshooting', '_blank')}
                className="flex items-center gap-2"
              >
                <ExternalLink className="size-4" />
                Get Help
              </Button>
              
              {onDismiss && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onDismiss}
                  className="ml-auto"
                >
                  Dismiss
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
        Error occurred at {error.timestamp.toLocaleString()}
      </div>
    </Card>
  );
};

// Types are exported above, parseError is available from '@/utils/errorParser'