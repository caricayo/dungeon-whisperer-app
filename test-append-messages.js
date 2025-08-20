import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAppendMessages() {
  console.log('🧪 Testing append_session_messages function...\n');
  
  try {
    // Test if the function exists by calling it with dummy data
    const { data, error } = await supabase.rpc('append_session_messages', {
      session_id: '12345678-1234-1234-1234-123456789012', // Dummy UUID
      user_message: {
        id: 'test-user-msg',
        role: 'user',
        content: 'Test user message',
        timestamp: new Date().toISOString()
      },
      assistant_message: {
        id: 'test-ai-msg',
        role: 'assistant', 
        content: 'Test assistant message',
        timestamp: new Date().toISOString()
      }
    });
    
    if (error) {
      if (error.message.includes('function append_session_messages') || 
          error.message.includes('does not exist')) {
        console.log('❌ MISSING FUNCTION: append_session_messages does not exist');
        console.log('   This function is needed for multiplayer chat to work');
        console.log('   Error:', error.message);
      } else if (error.message.includes('Session not found') ||
                 error.message.includes('Authentication required')) {
        console.log('✅ FUNCTION EXISTS: append_session_messages is available');
        console.log('   Expected error for dummy data:', error.message);
      } else {
        console.log('⚠️ FUNCTION EXISTS but has other issues');
        console.log('   Error:', error.message);
      }
    } else {
      console.log('✅ FUNCTION EXISTS and worked with dummy data');
      console.log('   Result:', data);
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

testAppendMessages();