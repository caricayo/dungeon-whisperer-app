/**
 * Production security headers for deployment
 * These should be configured at the CDN/server level
 */

export const PRODUCTION_SECURITY_HEADERS = {
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Prevent embedding in frames
  'X-Frame-Options': 'DENY',
  
  // Enable HSTS (HTTPS only)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  
  // Control referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Disable dangerous permissions
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
  
  // Cross-origin policies
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
  
  // Content Security Policy for production
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'", // No inline scripts in production
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Allow inline styles and Google Fonts
    "img-src 'self' data: https:",
    "media-src 'self' blob: data:", // Allow audio/video from blobs and data URLs
    "connect-src 'self' blob: data: https://*.supabase.co wss://*.supabase.co",
    "font-src 'self' data: https://fonts.gstatic.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; '),
};

/**
 * Instructions for deployment:
 * 
 * 1. Netlify: Add to netlify.toml
 * [[headers]]
 * for = "/*"
 * [headers.values]
 * X-Content-Type-Options = "nosniff"
 * # ... other headers
 * 
 * 2. Vercel: Add to vercel.json
 * {
 *   "headers": [
 *     {
 *       "source": "/(.*)",
 *       "headers": [
 *         { "key": "X-Content-Type-Options", "value": "nosniff" }
 *       ]
 *     }
 *   ]
 * }
 * 
 * 3. Cloudflare: Configure via Transform Rules
 * 4. Nginx: Add to server configuration
 * 5. Apache: Add to .htaccess
 */

export const DEPLOYMENT_INSTRUCTIONS = `
Production Deployment Security Checklist:

✅ Configure security headers at CDN/server level
✅ Enable HSTS preloading
✅ Set up proper CSP with nonce for scripts if needed
✅ Configure rate limiting at edge/server
✅ Enable DDoS protection
✅ Set up proper SSL/TLS certificates
✅ Configure proper CORS policies
✅ Enable security monitoring and alerts
✅ Regular security audits and penetration testing
`;