// Test script to trigger audio functionality and potential errors
// Run this in the browser console when on the actual D&D Chat application

console.log('🧪 AUDIO TESTING SCRIPT LOADED');

// Function to simulate audio generation attempt
async function testAudioGeneration() {
    console.log('🎵 Testing TTS audio generation...');
    
    try {
        // This will attempt to use the TTS service and should trigger the comprehensive debugging
        // Look for the generateAudio function in the application
        const testMessage = "Hello, brave adventurer! This is a test of the mystical voice magic.";
        
        // Try to find the TTS function
        if (window.generateTTS) {
            await window.generateTTS(testMessage);
        } else {
            console.warn('⚠️ generateTTS function not found on window object');
            
            // Create a test audio element and try to play it
            const audio = new Audio();
            audio.src = 'data:audio/wav;base64,invalid-data-to-trigger-error';
            
            try {
                await audio.play();
            } catch (error) {
                console.error('🔴 Audio playback error (expected):', error);
                
                // Store audio error for debugging
                window.__audio_mystery_error = {
                    errorName: error.name,
                    audioUrlValid: false,
                    userInteraction: document.hasFocus(),
                    documentState: {
                        hasFocus: document.hasFocus(),
                        visibilityState: document.visibilityState
                    },
                    audioSupport: {
                        canPlayMP3: (() => {
                            const testAudio = new Audio();
                            return testAudio.canPlayType('audio/mpeg');
                        })()
                    },
                    originalError: error.message,
                    timestamp: new Date().toISOString()
                };
                
                throw error; // Re-throw to trigger error handling
            }
        }
        
    } catch (error) {
        console.error('🔴 TTS Test Error:', error);
        return error;
    }
}

// Function to test the error dialog appearance
function triggerErrorDialog() {
    console.log('🎭 Attempting to trigger error dialog...');
    
    // Look for error state setters or error handling in React components
    // This might need to be adapted based on the actual component structure
    
    try {
        // Create a synthetic error event
        const mockError = new Error('Test error for enhanced dialog verification');
        mockError.name = 'TestError';
        
        // Try to trigger the error state in the chat container
        const errorEvent = new CustomEvent('chatError', {
            detail: { error: mockError }
        });
        
        document.dispatchEvent(errorEvent);
        
        console.log('✅ Error event dispatched. Check UI for enhanced error dialog.');
        
    } catch (error) {
        console.error('❌ Failed to trigger error dialog:', error);
    }
}

// Function to check if enhanced debugging is working
function checkEnhancedDebugging() {
    console.log('🔍 CHECKING ENHANCED DEBUGGING FEATURES...');
    
    const checks = {
        debugErrorsArray: !!window.__debug_errors,
        ttsErrorStorage: !!window.__tts_mystery_error,
        audioErrorStorage: !!window.__audio_mystery_error,
        exportFunction: typeof window.exportAllDebugInfo === 'function',
        debugHelperLoaded: typeof exportAllDebugInfo === 'function'
    };
    
    console.table(checks);
    
    if (checks.debugHelperLoaded) {
        console.log('✅ Debug helper is loaded and ready');
        console.log('💡 You can run: exportAllDebugInfo() to get complete debug report');
    } else {
        console.log('❌ Debug helper not loaded. Loading now...');
        
        // Try to load debug helper
        const script = document.createElement('script');
        script.src = '/debug-helper.js';
        script.onload = () => {
            console.log('✅ Debug helper loaded successfully!');
            console.log('💡 You can now run: exportAllDebugInfo()');
        };
        script.onerror = () => {
            console.error('❌ Failed to load debug helper script');
        };
        document.head.appendChild(script);
    }
    
    return checks;
}

// Auto-run checks
console.log('🚀 RUNNING AUTOMATIC CHECKS...');
checkEnhancedDebugging();

// Export functions for manual testing
window.testAudioGeneration = testAudioGeneration;
window.triggerErrorDialog = triggerErrorDialog;
window.checkEnhancedDebugging = checkEnhancedDebugging;

console.log(`
🧙‍♂️ AUDIO TESTING COMMANDS AVAILABLE:
• testAudioGeneration() - Test TTS and audio playback
• triggerErrorDialog() - Attempt to show enhanced error dialog
• checkEnhancedDebugging() - Verify debug features are working
• exportAllDebugInfo() - Export complete debug report (if helper loaded)

📝 TESTING STEPS:
1. First run: checkEnhancedDebugging()
2. Try to trigger audio: testAudioGeneration() 
3. If error occurs, check if enhanced dialog appears
4. Use exportAllDebugInfo() to get complete debug report
5. Test the "Export Debug" and "Copy Debug Commands" buttons in error dialog
`);