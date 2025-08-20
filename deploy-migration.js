import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deployMigration() {
  try {
    console.log('🚀 Deploying multiplayer join fixes migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20250820200002_multiplayer_join_fixes_consolidated.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded successfully');
    console.log(`📝 SQL length: ${migrationSQL.length} characters`);
    
    // Split migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--') && stmt !== '');
    
    console.log(`⚡ Executing ${statements.length} SQL statements...`);
    
    let successCount = 0;
    let errors = [];
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length < 10) continue; // Skip very short statements
      
      console.log(`📝 Statement ${i + 1}/${statements.length}: ${statement.substring(0, 80)}...`);
      
      try {
        const { data, error } = await supabase
          .from('_dummy') // This will fail but might execute the SQL
          .select('*')
          .limit(0);
        
        // Try using a raw query instead
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({ query: statement })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          errors.push(`Statement ${i + 1}: ${errorText}`);
        } else {
          successCount++;
        }
      } catch (err) {
        errors.push(`Statement ${i + 1}: ${err.message}`);
      }
    }
    
    if (errors.length > 0) {
      console.log(`⚠️ Migration completed with ${successCount} successes and ${errors.length} errors`);
      errors.slice(0, 5).forEach(error => console.log('❌', error));
    } else {
      console.log('✅ Migration deployed successfully!');
    }
    
    if (error) {
      console.error('❌ Migration failed:', error.message);
      if (error.details) {
        console.error('📋 Details:', error.details);
      }
      if (error.hint) {
        console.error('💡 Hint:', error.hint);
      }
      process.exit(1);
    }
    
    console.log('✅ Migration deployed successfully!');
    console.log('🎯 Result:', data);
    
    // Test the new functions
    console.log('\n🧪 Testing new functions...');
    
    // Test profile validation
    const { data: testData, error: testError } = await supabase.rpc('validate_user_profile_for_session', {
      user_id: 'test-user-id'
    });
    
    if (testError && !testError.message.includes('invalid input syntax')) {
      console.log('⚠️ Profile validation test:', testError.message);
    } else {
      console.log('✅ Profile validation function deployed');
    }
    
  } catch (err) {
    console.error('💥 Unexpected error:', err.message);
    process.exit(1);
  }
}

deployMigration();