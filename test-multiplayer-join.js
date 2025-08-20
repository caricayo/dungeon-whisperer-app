import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testMultiplayerJoin() {
  console.log('🧪 Testing multiplayer join flow...\n');
  
  try {
    // Step 1: Check if we can authenticate (you'll need to be signed in)
    console.log('📝 Step 1: Testing authentication...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('❌ No authenticated user found. Please sign in first.');
      console.log('   You need to sign in to the app first, then run this test.');
      return;
    }
    
    console.log('✅ User authenticated:', user.email);
    console.log('   User ID:', user.id);
    
    // Step 2: Test profile validation
    console.log('\n📝 Step 2: Testing profile validation...');
    const { data: profileResult, error: profileError } = await supabase.rpc('validate_user_profile_for_session', {
      user_id: user.id
    });
    
    if (profileError) {
      console.log('❌ Profile validation error:', profileError.message);
    } else {
      console.log('✅ Profile validation result:', JSON.stringify(profileResult, null, 2));
    }
    
    // Step 3: Check for existing multiplayer sessions
    console.log('\n📝 Step 3: Looking for existing multiplayer sessions...');
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .eq('is_multiplayer', true)
      .eq('status', 'active')
      .is('deleted_at', null)
      .limit(5);
    
    if (sessionsError) {
      console.log('❌ Error fetching sessions:', sessionsError.message);
    } else {
      console.log('✅ Found', sessions.length, 'active multiplayer sessions');
      sessions.forEach((session, index) => {
        console.log(`   ${index + 1}. "${session.name}" (${session.id})`);
        console.log(`      Created by: ${session.user_id}`);
        console.log(`      Max players: ${session.max_players || 6}`);
      });
      
      // Step 4: Test join_session_v2 with the first session (if any)
      if (sessions.length > 0) {
        const testSession = sessions[0];
        console.log('\n📝 Step 4: Testing join_session_v2 function...');
        console.log('   Testing with session:', testSession.name, '(' + testSession.id + ')');
        
        const { data: joinResult, error: joinError } = await supabase.rpc('join_session_v2', {
          session_id: testSession.id
        });
        
        if (joinError) {
          console.log('❌ Join session error:', joinError.message);
          console.log('   Error details:', joinError);
        } else {
          console.log('✅ Join session result:', JSON.stringify(joinResult, null, 2));
        }
      } else {
        console.log('\n⚠️ No multiplayer sessions found to test with.');
        console.log('   You may need to create a multiplayer session first.');
      }
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

testMultiplayerJoin();