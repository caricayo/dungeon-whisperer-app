// Test if environment variables are properly bundled
console.log('=== Environment Variables Test ===');
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('VITE_SUPABASE_ANON_KEY exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
console.log('NODE_ENV:', import.meta.env.NODE_ENV);
console.log('MODE:', import.meta.env.MODE);

// Test Supabase client initialization
try {
  const { supabase } = await import('./src/integrations/supabase/client.js');
  console.log('✅ Supabase client initialized successfully');
} catch (error) {
  console.error('❌ Supabase client failed to initialize:', error.message);
}