import { z } from 'zod';

// Environment validation schema using Zod
const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  VITE_DEMO_MODE: z
    .string()
    .optional()
    .default('false')
    .transform(() => false), // Always disable demo mode - all users are paid users
  VITE_APP_ENV: z
    .enum(['development', 'staging', 'production'])
    .optional()
    .default('development'),
  VITE_DEBUG_MODE: z
    .string()
    .optional()
    .default('false')
    .transform((val) => val === 'true'),
  VITE_ANALYTICS_ID: z.string().optional(),
  VITE_SENTRY_DSN: z.string().optional(),
  VITE_PERFORMANCE_MONITORING: z
    .string()
    .optional()
    .default('false')
    .transform((val) => val === 'true'),
});

// Parse and validate environment variables
function validateEnv() {
  try {
    const env = envSchema.parse({
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
      VITE_DEMO_MODE: 'false', // Hardcoded to false - demo mode disabled
      VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
      VITE_DEBUG_MODE: import.meta.env.VITE_DEBUG_MODE,
      VITE_ANALYTICS_ID: import.meta.env.VITE_ANALYTICS_ID,
      VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
      VITE_PERFORMANCE_MONITORING: import.meta.env.VITE_PERFORMANCE_MONITORING,
    });
    
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Environment validation failed - throwing error
      error.errors.forEach((err) => {
        // Log error path and message for debugging in development only
        if (import.meta.env.DEV) {
          console.error(`Environment error: ${err.path.join('.')}: ${err.message}`);
        }
      });
      throw new Error('Invalid environment configuration');
    }
    throw error;
  }
}

// Export validated environment
export const env = validateEnv();

// Type-safe environment access
export type Env = typeof env;

// Debug helper for development only
if (env.VITE_DEBUG_MODE && env.VITE_APP_ENV === 'development' && import.meta.env.DEV) {
  console.log('🔧 Environment Configuration:', {
    ...env,
    VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY?.slice(0, 10) + '...',
  });
}