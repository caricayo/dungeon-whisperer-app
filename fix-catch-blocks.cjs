const fs = require('fs');
const path = require('path');

// Files with catch (_error) patterns that need to be fixed
const files = [
  'src/components/chat/ChatInput.tsx',
  'src/components/WorldSelector.tsx',
  'src/components/UsageTracker.tsx',
  'src/components/AppSidebar.tsx',
  'src/components/chat/ChatContainer.tsx',
  'src/lib/session-utils.ts',
  'src/lib/query-cache.ts',
  'src/lib/performance.ts',
  'src/lib/demo-mode-guard.ts',
  'src/lib/env.ts',
  'src/lib/enterprise/Logger.ts',
  'src/lib/enterprise/MetricsCollector.ts',
  'src/hooks/usePresenceManager.ts',
  'src/pages/Sessions.tsx',
  'src/pages/RoomJoin.tsx',
  'src/lib/tts.ts',
  'src/lib/settings.ts',
  'src/lib/security.ts',
  'src/lib/secureRemoteTransport.ts',
  'src/lib/monitoring.ts',
  'src/lib/performance-monitor.ts',
  'src/lib/crypto.ts',
  'src/hooks/useStandardizedRealtime.ts',
  'src/hooks/useUserSettings.ts',
  'src/hooks/useSocialManager.ts',
  'src/hooks/useSessionManager.ts',
  'src/hooks/useSessionJoiningV2.ts',
  'src/hooks/useSessionJoining.ts',
  'src/hooks/useRoomJoinOrchestrator.ts',
  'src/hooks/useReliableRealtime.ts',
  'src/hooks/useRetry.ts',
  'src/hooks/useRealtimeManager.ts',
  'src/hooks/useReadReceipts.ts',
  'src/hooks/usePerformanceMonitor.ts',
  'src/hooks/useMultiplayerSessions.ts',
  'src/hooks/useMultiplayerSessionManager.ts',
  'src/hooks/useEnhancedPresenceManager.ts',
  'src/hooks/useDirectMessages.ts',
  'src/hooks/useConnectionStabilizer.ts',
  'src/hooks/chat/useChatService.ts',
  'src/domains/chat/services/ChatService.ts',
  'src/contexts/UserProfileContext.tsx',
  'src/contexts/AuthContext.tsx',
  'src/components/VoiceSettings.tsx',
  'src/components/chat/MessageList.tsx'
];

const rootDir = __dirname;

files.forEach(file => {
  const filePath = path.join(rootDir, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Replace catch (_error) with catch
    const catchPattern = /catch\s*\(\s*_error\s*\)\s*{/g;
    if (catchPattern.test(content)) {
      content = content.replace(catchPattern, 'catch {');
      modified = true;
    }
    
    // Also handle catch (error) where error is not used
    const unusedErrorPattern = /catch\s*\(\s*error\s*\)\s*{([^}]*(?:{[^}]*}[^}]*)*)}/g;
    let match;
    while ((match = unusedErrorPattern.exec(content)) !== null) {
      const catchBody = match[1];
      // Check if 'error' is used in the catch body
      if (!catchBody.includes('error')) {
        const before = content.substring(0, match.index);
        const after = content.substring(match.index + match[0].length);
        const replacement = 'catch {' + catchBody + '}';
        content = before + replacement + after;
        modified = true;
        // Reset regex since we modified the string
        unusedErrorPattern.lastIndex = 0;
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed: ${file}`);
    }
  } catch (err) {
    console.error(`Error processing ${file}:`, err.message);
  }
});

console.log('Catch block fixes completed!');