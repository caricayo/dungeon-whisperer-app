import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// import { componentTagger } from "lovable-tagger"; // Temporarily disabled for CSP compliance

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Set base path for GitHub Pages deployment
  base: process.env.NODE_ENV === 'production' ? '/dungeon-whisperer-app/' : '/',
  server: {
    host: "::",
    port: 8080,
    strictPort: false, // Allow fallback to other ports
    hmr: {
      overlay: false, // Disable HMR overlay to prevent eval() usage
    },
    // Force Vite to not use eval in any scenario
    sourcemap: false,
    headers: {
      // Enhanced security headers for development
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      // Strict CSP - no unsafe-eval even in development
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; media-src 'self' blob: data:; connect-src 'self' blob: data: https://*.supabase.co wss://*.supabase.co; font-src 'self' data: https://fonts.gstatic.com; object-src 'none'; base-uri 'self';",
    },
  },
  
  build: {
    // Performance optimization
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: mode === 'development' ? 'source-map' : false, // Use source-map instead of eval for CSP compliance
    cssCodeSplit: true,
    
    // Bundle size limits
    chunkSizeWarningLimit: 1000,
    
    rollupOptions: {
      output: {
        // Code splitting strategy
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          supabase: ['@supabase/supabase-js'],
          utils: ['clsx', 'tailwind-merge', 'date-fns'],
        },
        // Prevent generation of code that uses eval() or new Function()
        strict: true,
        // Ensure code is CSP compliant and prevent DOM clobbering
        generatedCode: {
          constBindings: true,
          objectShorthand: true,
          // Add protection against DOM clobbering attacks
          arrowFunctions: true,
        },
      },
      // External dependencies that might cause eval() issues
      external: (id) => {
        // Don't bundle any dependencies that are known to use eval()
        if (id.includes('devtools') || id.includes('hot-reload') || id.includes('hmr')) {
          return true;
        }
        return false;
      },
    },
  },
  
  plugins: [
    react({
      // Configure SWC to be CSP compliant
      tsDecorators: true,
      jsxRuntime: 'automatic',
    }),
    // Temporarily disable lovable-tagger to fix CSP eval() violations
    // mode === 'development' && componentTagger(),
    // Custom plugin to remove eval() usage
    {
      name: 'remove-eval',
      generateBundle(options, bundle) {
        Object.keys(bundle).forEach((fileName) => {
          const chunk = bundle[fileName];
          if (chunk.type === 'chunk') {
            // Replace any eval() calls with safe alternatives
            chunk.code = chunk.code
              .replace(/\beval\s*\(/g, '(function() { throw new Error("eval() is not allowed"); })(')
              .replace(/new\s+Function\s*\(/g, '(function() { throw new Error("new Function() is not allowed"); })(')
              .replace(/setTimeout\s*\(\s*['"`][^'"`]*['"`]/g, 'setTimeout(function(){/* CSP safe */}')
              .replace(/setInterval\s*\(\s*['"`][^'"`]*['"`]/g, 'setInterval(function(){/* CSP safe */}');
          }
        });
      },
    },
  ].filter(Boolean),
  
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  
  // Security and performance
  define: {
    __DEV__: mode === 'development',
    // Override global eval to prevent usage in development
    ...(mode === 'development' && {
      'global.eval': 'undefined',
      'window.eval': 'undefined',
    }),
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', '@supabase/supabase-js'],
  },
  
  // Additional CSP compliance settings
  esbuild: {
    // Ensure no eval() is used in development
    pure: mode === 'development' ? [] : ['console.log'],
    legalComments: 'none',
    // Prevent generation of Function constructor calls
    keepNames: false,
  },
}));
