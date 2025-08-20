# Authentication Setup with Google OAuth

## 🚨 Important: Google OAuth Configuration Required

To enable Google sign-in for your D&D chatbot, you need to configure Google OAuth in your Supabase dashboard:

### Step 1: Configure Google OAuth Provider

1. **Go to your Supabase Dashboard**
   - Navigate to Authentication → Providers
   - Find "Google" in the list and click to configure

2. **Get Google OAuth Credentials**
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Google+ API
   - Go to "Credentials" and create OAuth 2.0 Client IDs
   - Set authorized redirect URI to: `https://[your-project-ref].supabase.co/auth/v1/callback`

3. **Configure in Supabase**
   - Enter your Google Client ID and Client Secret
   - Enable the Google provider
   - Save the configuration

### Step 2: Update Site URL (if needed)

In Supabase Dashboard → Authentication → Settings:
- Set your Site URL to your domain (for development: `http://localhost:5173`)
- Add any additional redirect URLs if needed

### Step 3: Test the Integration

The app now supports both:
- ✅ **Email/Password authentication** - Traditional sign up/sign in
- ✅ **Google OAuth** - One-click Google sign-in
- ✅ **Background image switching** - Click any generated image to set it as background

### Features Added:

1. **Dynamic Background**: Generated D&D scene images can now be clicked to set as the app background with a smooth transition effect.

2. **Google Sign-In**: Added Google OAuth integration for quick authentication - users can sign in with their Google account instead of creating a new password.

3. **Enhanced UX**: 
   - Visual feedback when clicking images
   - Toast notifications for background changes
   - Improved authentication flow with both options available

### Security Notes:

- Google OAuth provides additional security through Google's authentication system
- Users can still use traditional email/password if they prefer
- All previous security features (encryption, RLS, etc.) remain active
- Google sign-in respects the same rate limiting and validation rules

Once you configure Google OAuth in Supabase, users will be able to sign in instantly with their Google accounts! 🚀