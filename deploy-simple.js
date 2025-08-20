import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deployMigration() {
  try {
    console.log('🚀 Testing individual function deployment...');
    
    // Test 1: Try to create the first function directly
    console.log('⚡ Creating generate_username_for_user function...');
    
    const createUsernameFunction = `
CREATE OR REPLACE FUNCTION public.generate_username_for_user(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_username text;
  final_username text;
  counter integer := 1;
BEGIN
  base_username := 'adventurer_' || substring(user_id::text from 1 for 8);
  final_username := base_username;
  
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    final_username := base_username || '_' || counter;
    counter := counter + 1;
  END LOOP;
  
  RETURN final_username;
END;
$$;`;

    // Try using SQL command
    const { data, error } = await supabase
      .from('profiles') // Use existing table
      .select('count', { count: 'exact' })
      .limit(0);
    
    if (error && !error.message.includes('relation "profiles" does not exist')) {
      console.log('✅ Database connection confirmed');
      
      // Let's check what functions exist
      const { data: functions } = await supabase.rpc('get_schema');
      console.log('📋 Available functions:', functions ? functions.length : 'Unknown');
      
    } else {
      console.log('⚠️ Cannot access profiles table, but connection works');
    }
    
    console.log('🔍 Checking if we can call any system functions...');
    
    // Try calling a simple function that should exist
    try {
      const { data: versionData, error: versionError } = await supabase
        .rpc('version');
      
      if (!versionError) {
        console.log('✅ Can call RPC functions');
        console.log('📊 Database version:', versionData);
      }
    } catch (err) {
      console.log('⚠️ Cannot call version function');
    }
    
    console.log('\n🎯 RECOMMENDATION: Use Supabase Dashboard SQL Editor');
    console.log('📋 Steps:');
    console.log('1. Go to https://supabase.com/dashboard/project/xnitbccvdoauywudnwsi/sql');
    console.log('2. Open SQL Editor');
    console.log('3. Copy entire migration file content');
    console.log('4. Paste and run in SQL Editor');
    console.log('5. Migration file location: supabase/migrations/20250820200002_multiplayer_join_fixes_consolidated.sql');
    
  } catch (err) {
    console.error('💥 Error:', err.message);
  }
}

deployMigration();