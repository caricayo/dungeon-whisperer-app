// Debug script to test TTS service step by step
// Run with: node debug-tts.js

const SUPABASE_URL = 'https://xnitbccvdoauywudnwsi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaXRiY2N2ZG9hdXl3dWRud3NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNjY1NDQsImV4cCI6MjA3MDc0MjU0NH0.tW3Gi-Af-Joqb5QXBTFAUtEvd2qTOog55cp_r7NttFI';

async function debugTtsFlow() {
  console.log('🚀 Starting TTS Debug Flow...\n');

  try {
    // Step 1: Call TTS API
    console.log('1️⃣ Calling TTS API...');
    const response = await fetch(`${SUPABASE_URL}/functions/v1/dnd-tts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'The brave adventurer draws their sword as the dragon approaches.',
        voice: 'alloy',
        model: 'tts-1'
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ TTS API Response:', {
      hasAudioContent: !!data.audioContent,
      audioContentLength: data.audioContent?.length || 0,
      firstChars: data.audioContent?.substring(0, 50) + '...',
      responseKeys: Object.keys(data)
    });

    // Step 2: Test base64 validity
    console.log('\n2️⃣ Validating base64 data...');
    const base64Data = data.audioContent;
    
    // Check base64 format
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    const isValidBase64 = base64Regex.test(base64Data);
    console.log('📝 Base64 format valid:', isValidBase64);
    
    if (!isValidBase64) {
      console.log('❌ Invalid base64 characters found');
      return;
    }

    // Step 3: Test data URL creation
    console.log('\n3️⃣ Creating data URL...');
    const dataUrl = `data:audio/mpeg;base64,${base64Data}`;
    console.log('🔗 Data URL created:', dataUrl.substring(0, 100) + '...');

    // Step 4: Test fetch of data URL (our new method)
    console.log('\n4️⃣ Testing data URL fetch...');
    const fetchResponse = await fetch(dataUrl);
    console.log('📊 Fetch response status:', fetchResponse.status);
    console.log('📊 Fetch response headers:', [...fetchResponse.headers.entries()]);

    if (!fetchResponse.ok) {
      throw new Error(`Data URL fetch failed: ${fetchResponse.status}`);
    }

    const audioBlob = await fetchResponse.blob();
    console.log('📦 Blob created:', {
      size: audioBlob.size,
      type: audioBlob.type,
      isEmpty: audioBlob.size === 0
    });

    // Step 5: Test manual base64 decode (fallback method)
    console.log('\n5️⃣ Testing manual base64 decode...');
    try {
      // Clean base64 string
      let cleanBase64 = base64Data.replace(/[^A-Za-z0-9+/=]/g, '');
      while (cleanBase64.length % 4) {
        cleanBase64 += '=';
      }

      const binaryString = atob(cleanBase64);
      const bytes = new Uint8Array(binaryString.length);
      
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const manualBlob = new Blob([bytes], { type: 'audio/mpeg' });
      console.log('📦 Manual blob created:', {
        size: manualBlob.size,
        type: manualBlob.type,
        isEmpty: manualBlob.size === 0
      });

    } catch (error) {
      console.log('❌ Manual base64 decode failed:', error.message);
    }

    // Step 6: Save debug info to file
    const fs = require('fs');
    const debugInfo = {
      timestamp: new Date().toISOString(),
      apiResponse: {
        hasAudioContent: !!data.audioContent,
        audioContentLength: data.audioContent?.length || 0,
        responseKeys: Object.keys(data)
      },
      blobInfo: {
        size: audioBlob.size,
        type: audioBlob.type,
        isEmpty: audioBlob.size === 0
      },
      base64Valid: isValidBase64
    };

    fs.writeFileSync('tts-debug-log.json', JSON.stringify(debugInfo, null, 2));
    console.log('\n💾 Debug info saved to tts-debug-log.json');

    console.log('\n🎯 DIAGNOSIS:');
    if (audioBlob.size === 0) {
      console.log('❌ ISSUE: Audio blob is empty - base64 decoding problem');
    } else if (!audioBlob.type.startsWith('audio/')) {
      console.log('❌ ISSUE: Audio blob has wrong MIME type');
    } else {
      console.log('✅ TTS processing appears to be working correctly');
      console.log('🔍 If audio still not playing in app, issue is likely:');
      console.log('   • Browser autoplay restrictions');
      console.log('   • JWT authentication differences between test and app');
      console.log('   • HTML audio element compatibility');
    }

  } catch (error) {
    console.log('\n💥 TTS Debug Failed:', error.message);
    console.log('🔍 Stack trace:', error.stack);
  }
}

debugTtsFlow().catch(console.error);