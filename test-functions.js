#!/usr/bin/env node

// Test script for Supabase Edge Functions
// Run with: node test-functions.js

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://xnitbccvdoauywudnwsi.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('❌ VITE_SUPABASE_ANON_KEY not found in environment variables');
  process.exit(1);
}

async function testFunction(functionName, payload) {
  console.log(`\n🧪 Testing ${functionName}...`);
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ ${functionName} SUCCESS`);
      console.log('Response keys:', Object.keys(data));
      return true;
    } else {
      const errorText = await response.text();
      console.log(`❌ ${functionName} FAILED`);
      console.log('Error:', errorText);
      return false;
    }
  } catch (error) {
    console.log(`💥 ${functionName} NETWORK ERROR:`, error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Supabase Edge Function Tests...');
  console.log('🔗 Supabase URL:', SUPABASE_URL);
  
  const results = {};

  // Test TTS functions
  results.dndTts = await testFunction('dnd-tts', {
    text: 'Hello world',
    voice: 'alloy',
    model: 'tts-1'
  });

  results.elevenlabsTts = await testFunction('elevenlabs-tts', {
    text: 'Hello world',
    voice: 'BNgbHR0DNeZixGQVzloa'
  });

  // Test image generation
  results.dndImage = await testFunction('dnd-image', {
    prompt: 'A red dragon',
    model: 'dall-e-3',
    size: '1024x1024'
  });

  // Test video generation
  results.dndVideo = await testFunction('dnd-video', {
    prompt: 'A medieval castle'
  });

  results.lumaVideo = await testFunction('luma-video', {
    prompt: 'A magical forest'
  });

  // Summary
  console.log('\n📋 TEST RESULTS SUMMARY:');
  console.log('='.repeat(40));
  Object.entries(results).forEach(([name, success]) => {
    console.log(`${success ? '✅' : '❌'} ${name}: ${success ? 'PASS' : 'FAIL'}`);
  });

  const passCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;
  console.log(`\n🎯 Overall: ${passCount}/${totalCount} functions working`);

  if (passCount === 0) {
    console.log('\n🔍 DIAGNOSIS: All functions failed - likely issues:');
    console.log('   • API keys not configured in Supabase secrets');
    console.log('   • Functions not deployed to Supabase project');
    console.log('   • JWT authentication issues');
  }
}

runTests().catch(console.error);